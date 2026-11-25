"""Platform Redis is separate from the existing Gachon SSO Redis."""

import hashlib
import os

from fastapi import HTTPException, Request
from redis.asyncio import Redis
from redis.exceptions import RedisError


async def init_cache(app):
    app.state.redis = Redis.from_url(
        os.getenv("REDIS_URL", "redis://127.0.0.1:6379/0"),
        decode_responses=True,
        socket_connect_timeout=3,
        socket_timeout=5,
    )
    await app.state.redis.ping()


async def close_cache(app):
    client = getattr(app.state, "redis", None)
    if client:
        await client.aclose()


async def rate_limit(request: Request, identity: str, *, category="upload", limit=60, seconds=60):
    key = f"nail:limit:{category}:" + hashlib.sha256(identity.encode()).hexdigest()
    script = "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]) end; return n"
    try:
        count = await request.app.state.redis.eval(script, 1, key, seconds)
    except RedisError as exc:
        raise HTTPException(503, "Request limiting service is unavailable.") from exc
    if count > limit:
        raise HTTPException(429, "Too many requests. Please retry later.", headers={"Retry-After": str(seconds)})
