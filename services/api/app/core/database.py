import ssl
from collections.abc import AsyncGenerator

from sqlalchemy import text
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.core.config import Settings, get_settings

_engine: AsyncEngine | None = None
_session_factory: async_sessionmaker[AsyncSession] | None = None


def build_async_database_url(database_url: str) -> str:
    url = make_url(database_url)
    driver = (
        "postgresql+asyncpg"
        if url.drivername in {"postgres", "postgresql"}
        else url.drivername
    )
    return url.set(drivername=driver).difference_update_query(["sslmode"]).render_as_string(
        hide_password=False
    )


def should_use_ssl(database_url: str, mode: str) -> bool:
    normalized_mode = mode.lower()
    if normalized_mode == "require":
        return True
    if normalized_mode == "disable":
        return False

    url = make_url(database_url)
    if url.query.get("sslmode") == "require":
        return True

    host = (url.host or "").lower()
    return host not in {"", "localhost", "127.0.0.1", "::1"}


def get_engine(settings: Settings | None = None) -> AsyncEngine:
    global _engine

    app_settings = settings or get_settings()
    if not app_settings.database_url:
        raise RuntimeError("Database URL is not configured.")

    if _engine is None:
        connect_args = {}
        if should_use_ssl(app_settings.database_url, app_settings.database_ssl):
            # Supabase em cloud exige TLS; local continua sem SSL por padrão.
            connect_args["ssl"] = ssl.create_default_context()

        _engine = create_async_engine(
            build_async_database_url(app_settings.database_url),
            connect_args=connect_args,
            pool_pre_ping=True,
            pool_size=5,
            max_overflow=10,
        )

    return _engine


def get_session_factory(settings: Settings | None = None) -> async_sessionmaker[AsyncSession]:
    global _session_factory

    if _session_factory is None:
        _session_factory = async_sessionmaker(
            bind=get_engine(settings),
            expire_on_commit=False,
        )

    return _session_factory


async def get_db_session() -> AsyncGenerator[AsyncSession]:
    session_factory = get_session_factory()
    async with session_factory() as session:
        yield session


async def check_database_connection() -> None:
    async with get_engine().connect() as connection:
        await connection.execute(text("select 1"))


async def dispose_engine() -> None:
    global _engine, _session_factory

    if _engine is not None:
        await _engine.dispose()
        _engine = None
        _session_factory = None
