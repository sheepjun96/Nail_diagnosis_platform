import aiomysql
from fastapi import Request
from typing import AsyncIterator

# 실제 환경에 맞게 수정
DB_CONFIG = {
    "host": "127.0.0.1",
    "port": 3306,
    "user": "gcubme",
    "password": "gcubme@@!!",
    "db": "curaxel_skin",
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
    """
    FastAPI Depends 에서 사용할 커넥션 의존성
    """
    pool = request.app.state.db_pool
    async with pool.acquire() as conn:
        yield conn