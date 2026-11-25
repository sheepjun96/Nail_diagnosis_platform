"""Request transactions; database service functions never commit independently."""

import asyncio
from contextlib import asynccontextmanager
import logging
import os
from typing import AsyncIterator

import aiomysql
from fastapi import Request

logger = logging.getLogger(__name__)

# 실제 환경에 맞게 수정
DB_CONFIG = {
    "host": os.getenv("DB_HOST", "127.0.0.1"),
    "port": int(os.getenv("DB_PORT", "3308")),
    "user": os.getenv("DB_USER", "curaxel_user"),
    "password": os.getenv("DB_PASSWORD", ""),
    "db": os.getenv("DB_NAME", "curaxel_skin"),
    "minsize": 1,
    "maxsize": int(os.getenv("DB_POOL_SIZE", "10")),
    "autocommit": False,
    "charset": "utf8mb4",
    "connect_timeout": 10,
    "pool_recycle": 1800,
}


async def init_db(app):
    for attempt in range(1, 16):
        try:
            app.state.db_pool = await aiomysql.create_pool(**DB_CONFIG)
            return
        except (OSError, aiomysql.Error):
            if attempt == 15:
                raise
            logger.warning("Database unavailable; retry %s/15", attempt)
            await asyncio.sleep(min(attempt, 5))


async def close_db(app):
    pool = getattr(app.state, "db_pool", None)
    if pool:
        pool.close()
        await pool.wait_closed()


@asynccontextmanager
async def transaction(pool):
    async with pool.acquire() as conn:
        await conn.begin()
        try:
            yield conn
            await conn.commit()
        except BaseException:
            await conn.rollback()
            raise


async def get_conn(request: Request) -> AsyncIterator[aiomysql.Connection]:
    # Function scope dependencies commit before a successful response is sent.
    request.state.saved_uploads = []
    try:
        async with transaction(request.app.state.db_pool) as conn:
            yield conn
    except BaseException:
        from services.storage import remove_files
        remove_files(request.state.saved_uploads)
        raise
