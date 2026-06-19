from typing import Annotated

from fastapi import APIRouter, Depends

from app.core.auth import UserContext, get_current_user_context

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/context")
async def read_auth_context(
    context: Annotated[UserContext, Depends(get_current_user_context)],
) -> UserContext:
    return context
