from typing import Any

import jwt
from jwt import InvalidTokenError

from app.core.config import Settings, get_settings


class AuthError(Exception):
    pass


def decode_supabase_token(token: str, settings: Settings | None = None) -> dict[str, Any]:
    app_settings = settings or get_settings()
    if app_settings.supabase_jwt_secret is None:
        raise AuthError("Supabase JWT secret is not configured.")

    # O JWT identifica o usuário; permissões reais são sempre buscadas no banco.
    decode_options: dict[str, Any] = {
        "algorithms": ["HS256"],
        "audience": app_settings.supabase_jwt_audience,
    }
    if app_settings.supabase_jwt_issuer:
        decode_options["issuer"] = app_settings.supabase_jwt_issuer

    try:
        payload = jwt.decode(
            token,
            app_settings.supabase_jwt_secret.get_secret_value(),
            **decode_options,
        )
    except InvalidTokenError as exc:
        raise AuthError("Invalid authentication token.") from exc

    if not payload.get("sub"):
        raise AuthError("Authentication token does not contain a user id.")

    return payload
