import aiomysql
from fastapi import Request
from typing import AsyncIterator
import os

# 실제 환경에 맞게 수정
DB_CONFIG = {
    "host": os.getenv("DB_HOST", "db"),
    "port": int(os.getenv("DB_PORT", "3306")),
    "user": os.getenv("DB_USER", "curaxel_user"),
    "password": os.getenv("DB_PASSWORD", "curaxel_pass"),
    "db": os.getenv("DB_NAME", "curaxel_skin"),
    "minsize": 1,
    "maxsize": 10,
    "autocommit": True,
    "charset": "utf8mb4",
}


async def init_db(app):
    app.state.db_pool = await aiomysql.create_pool(**DB_CONFIG)


async def close_db(app):
    pool = app.state.db_pool
    pool.close()
    await pool.wait_closed()


async def get_conn(request: Request) -> AsyncIterator[aiomysql.Connection]:
    pool = request.app.state.db_pool
    async with pool.acquire() as conn:
        yield conn