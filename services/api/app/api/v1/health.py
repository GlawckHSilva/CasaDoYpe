from fastapi import APIRouter, HTTPException, status

from app.core.database import check_database_connection

router = APIRouter(prefix="/health", tags=["health"])


@router.get("")
async def healthcheck() -> dict[str, str]:
    try:
        await check_database_connection()
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"status": "degraded", "database": "unavailable"},
        ) from exc

    return {"status": "ok", "database": "ok"}
