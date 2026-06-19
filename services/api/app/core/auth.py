import json
from collections.abc import AsyncGenerator, Awaitable, Callable
from typing import Annotated, Any, Literal
from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, ConfigDict
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.database import get_session_factory
from app.core.security import AuthError, decode_supabase_token

UserRole = Literal["guest", "owner", "staff", "super_admin"]

bearer_scheme = HTTPBearer(auto_error=False)


class UserContext(BaseModel):
    model_config = ConfigDict(frozen=True)

    user_id: UUID
    tenant_id: UUID | None
    role: UserRole
    permissions: tuple[str, ...]

    def has_permission(self, permission: str) -> bool:
        return self.role in {"owner", "super_admin"} or permission in self.permissions


async def apply_database_auth_context(
    session: AsyncSession,
    token_payload: dict[str, Any],
) -> None:
    user_id = str(token_payload["sub"])
    claims = {**token_payload, "role": "authenticated"}

    if get_settings().database_set_role:
        # Mantém as queries futuras compatíveis com RLS do Supabase/auth.uid().
        await session.execute(text("set local role authenticated"))

    # Replica os claims validados na transação atual para isolamento multi-tenant.
    await session.execute(
        text("select set_config('request.jwt.claims', :claims, true)"),
        {"claims": json.dumps(claims, separators=(",", ":"))},
    )
    await session.execute(
        text("select set_config('request.jwt.claim.sub', :user_id, true)"),
        {"user_id": user_id},
    )
    await session.execute(
        text("select set_config('request.jwt.claim.role', 'authenticated', true)"),
    )


async def get_token_payload(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
) -> dict[str, Any]:
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing bearer token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        token_payload = decode_supabase_token(credentials.credentials)
    except AuthError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    return token_payload


async def get_current_user_context(
    token_payload: Annotated[dict[str, Any], Depends(get_token_payload)],
) -> UserContext:
    session_factory = get_session_factory()
    async with session_factory() as session:
        await apply_database_auth_context(session, token_payload)
        return await load_user_context(session, UUID(str(token_payload["sub"])))


async def get_authenticated_db_session(
    token_payload: Annotated[dict[str, Any], Depends(get_token_payload)],
) -> AsyncGenerator[AsyncSession]:
    session_factory = get_session_factory()
    async with session_factory() as session:
        # Dependência para endpoints futuros executarem queries já dentro do contexto RLS.
        await apply_database_auth_context(session, token_payload)
        yield session


async def load_user_context(session: AsyncSession, user_id: UUID) -> UserContext:
    profile = await load_profile(session, user_id)
    if profile is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Profile not found.")

    if profile["platform_role"] == "super_admin":
        # Super Admin opera fora de um tenant específico e pode acessar rotas globais.
        return UserContext(
            user_id=user_id,
            tenant_id=None,
            role="super_admin",
            permissions=("*",),
        )

    membership = await load_active_membership(session, user_id)
    if membership is not None:
        # Funcionários e proprietários herdam tenant, role e permissões do vínculo ativo.
        role: UserRole = "owner" if membership["member_role"] == "owner" else "staff"
        role_id = membership["role_id"]
        permissions = await load_permissions(session, UUID(role_id)) if role_id else ()
        if role == "owner":
            permissions = tuple(sorted({"tenant.owner", *permissions}))

        return UserContext(
            user_id=user_id,
            tenant_id=UUID(membership["tenant_id"]),
            role=role,
            permissions=permissions,
        )

    owned_tenant_id = await load_owned_tenant_id(session, user_id)
    if owned_tenant_id is not None:
        return UserContext(
            user_id=user_id,
            tenant_id=owned_tenant_id,
            role="owner",
            permissions=("tenant.owner",),
        )

    return UserContext(user_id=user_id, tenant_id=None, role="guest", permissions=())


async def require_tenant_context(
    context: Annotated[UserContext, Depends(get_current_user_context)],
) -> UserContext:
    if context.tenant_id is None or context.role == "guest":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Tenant access required.")
    return context


async def require_super_admin_context(
    context: Annotated[UserContext, Depends(get_current_user_context)],
) -> UserContext:
    if context.role != "super_admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Super admin required.")
    return context


def require_permission(permission: str) -> Callable[..., Awaitable[UserContext]]:
    async def dependency(
        context: Annotated[UserContext, Depends(require_tenant_context)],
    ) -> UserContext:
        if not context.has_permission(permission):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permission denied.")
        return context

    return dependency


async def load_profile(session: AsyncSession, user_id: UUID) -> dict[str, Any] | None:
    result = await session.execute(
        text(
            """
            select id::text as id, platform_role
            from public.profiles
            where id = :user_id and deleted_at is null
            """
        ),
        {"user_id": str(user_id)},
    )
    row = result.mappings().one_or_none()
    return dict(row) if row else None


async def load_active_membership(session: AsyncSession, user_id: UUID) -> dict[str, Any] | None:
    result = await session.execute(
        text(
            """
            select tm.tenant_id::text as tenant_id,
                   tm.role_id::text as role_id,
                   tm.member_role
            from public.tenant_members tm
            join public.tenants t on t.id = tm.tenant_id
            where tm.user_id = :user_id
              and tm.status = 'active'
              and t.deleted_at is null
            order by tm.created_at asc
            limit 1
            """
        ),
        {"user_id": str(user_id)},
    )
    row = result.mappings().one_or_none()
    return dict(row) if row else None


async def load_owned_tenant_id(session: AsyncSession, user_id: UUID) -> UUID | None:
    result = await session.execute(
        text(
            """
            select id::text as tenant_id
            from public.tenants
            where owner_id = :user_id and deleted_at is null
            order by created_at asc
            limit 1
            """
        ),
        {"user_id": str(user_id)},
    )
    tenant_id = result.scalar_one_or_none()
    return UUID(str(tenant_id)) if tenant_id else None


async def load_permissions(session: AsyncSession, role_id: UUID) -> tuple[str, ...]:
    result = await session.execute(
        text(
            """
            select p.code
            from public.role_permissions rp
            join public.permissions p on p.id = rp.permission_id
            where rp.role_id = :role_id
            order by p.code asc
            """
        ),
        {"role_id": str(role_id)},
    )
    return tuple(str(row["code"]) for row in result.mappings())
