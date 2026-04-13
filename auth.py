import json
import os
from typing import Any, Optional
from urllib.parse import urlencode

import aiomysql
import jwt
from fastapi import HTTPException, Request, status
from redis.asyncio import Redis

AUTH_COOKIE_MAX_AGE = 60 * 60 * 12
REFRESH_COOKIE_MAX_AGE = 7 * 24 * 60 * 60
TOKEN_PREFIX = "tokenCode_"
LOGIN_INFO_PREFIX = "loginInfo_"
SSO_TICKET_PREFIX = "ssoTicket_"
SSO_SERVICE = "nail"
APP_HOME_PATH = "/app"
APP_LOGIN_PATH = "/app/login"

GACHON_AUTH_DB_CONFIG = {
    "host": os.getenv("GACHON_AUTH_DB_HOST", "10.2.52.209"),
    "port": int(os.getenv("GACHON_AUTH_DB_PORT", "3306")),
    "user": os.getenv("GACHON_AUTH_DB_USER", ""),
    "password": os.getenv("GACHON_AUTH_DB_PASSWORD", ""),
    "db": os.getenv("GACHON_AUTH_DB_NAME", "mis_db"),
    "minsize": 1,
    "maxsize": 5,
    "autocommit": True,
    "charset": "utf8mb4",
}


def _auth_is_configured() -> bool:
    required_values = [
        os.getenv("GACHON_AUTH_DB_USER"),
        os.getenv("GACHON_AUTH_DB_PASSWORD"),
        os.getenv("GACHON_SESSION_SECRET"),
        os.getenv("GACHON_REDIS_HOST"),
    ]
    return all(required_values)


def _cookie_secure(request: Request) -> bool:
    forwarded_proto = request.headers.get("x-forwarded-proto", request.url.scheme)
    scheme = forwarded_proto.split(",")[0].strip()
    return scheme == "https"


def _auth_error(detail: str, status_code: int = status.HTTP_401_UNAUTHORIZED) -> HTTPException:
    return HTTPException(status_code=status_code, detail=detail)


def _get_redis(request: Request) -> Redis:
    redis_client = getattr(request.app.state, "gachon_redis", None)
    if redis_client is None:
        raise _auth_error("Gachon shared auth is not configured.", status.HTTP_500_INTERNAL_SERVER_ERROR)
    return redis_client


def _get_optional_redis(request: Request) -> Optional[Redis]:
    return getattr(request.app.state, "gachon_redis", None)


def _get_auth_pool(request: Request) -> aiomysql.Pool:
    pool = getattr(request.app.state, "gachon_auth_db_pool", None)
    if pool is None:
        raise _auth_error("Gachon shared auth is not configured.", status.HTTP_500_INTERNAL_SERVER_ERROR)
    return pool


async def init_auth_resources(app) -> None:
    app.state.gachon_auth_db_pool = None
    app.state.gachon_redis = None

    if not _auth_is_configured():
        return

    app.state.gachon_auth_db_pool = await aiomysql.create_pool(**GACHON_AUTH_DB_CONFIG)
    app.state.gachon_redis = Redis(
        host=os.getenv("GACHON_REDIS_HOST", "10.2.52.209"),
        port=int(os.getenv("GACHON_REDIS_PORT", "6379")),
        decode_responses=True,
    )


async def close_auth_resources(app) -> None:
    auth_pool = getattr(app.state, "gachon_auth_db_pool", None)
    if auth_pool is not None:
        auth_pool.close()
        await auth_pool.wait_closed()

    redis_client = getattr(app.state, "gachon_redis", None)
    if redis_client is not None:
        await redis_client.aclose()


async def _get_member_by_seq(request: Request, m_seq: int) -> Optional[dict[str, Any]]:
    pool = _get_auth_pool(request)
    query = """
        SELECT
            m.m_seq,
            m.name,
            m.email,
            m.mr_seq,
            m.allow,
            m.del_yn,
            m.org_code,
            m.last_login_date,
            m.password_expiry_date,
            m.pseudonymization,
            mr.name AS role_name,
            mr.code,
            mr.authority,
            org.org_name,
            org.permission AS org_permission
        FROM member AS m
        LEFT JOIN member_role AS mr
            ON mr.mr_seq = m.mr_seq
        LEFT JOIN mis_organization AS org
            ON org.org_code = m.org_code
        WHERE m.m_seq = %s
        LIMIT 1
    """

    async with pool.acquire() as conn:
        async with conn.cursor(aiomysql.DictCursor) as cur:
            await cur.execute(query, (m_seq,))
            return await cur.fetchone()


async def _decode_cached_token(
    request: Request,
    token_type: str,
    token_code: Optional[str],
) -> Optional[dict[str, Any]]:
    if not token_code:
        return None

    redis_client = _get_redis(request)
    cached_token = await redis_client.get(f"{TOKEN_PREFIX}{token_type}_{token_code}")
    if not cached_token:
        return None

    try:
        decoded = jwt.decode(
            cached_token,
            os.getenv("GACHON_SESSION_SECRET", ""),
            algorithms=["HS256"],
        )
    except jwt.PyJWTError:
        return None

    member_data = await _get_member_by_seq(request, decoded.get("m_seq"))
    if not member_data:
        return None

    return {
        "decoded": decoded,
        "member": member_data,
    }


def _sanitize_member(member: dict[str, Any]) -> dict[str, Any]:
    return {
        "m_seq": member.get("m_seq"),
        "name": member.get("name"),
        "email": member.get("email"),
        "mr_seq": member.get("mr_seq"),
        "code": member.get("code"),
        "role_name": member.get("role_name"),
        "authority": member.get("authority"),
        "org_code": member.get("org_code"),
        "org_name": member.get("org_name"),
        "org_permission": member.get("org_permission"),
        "pseudonymization": member.get("pseudonymization"),
        "last_login_date": str(member.get("last_login_date")) if member.get("last_login_date") else None,
        "password_expiry_date": (
            str(member.get("password_expiry_date")) if member.get("password_expiry_date") else None
        ),
    }


async def get_authenticated_member(request: Request) -> dict[str, Any]:
    access_token_code = request.cookies.get("access_token") or request.headers.get("access_token")
    token_payload = await _decode_cached_token(request, "access", access_token_code)
    if token_payload is None:
        raise _auth_error("Authentication required.")

    member = token_payload["member"]
    if member.get("allow") != "Y" or member.get("del_yn") == "Y":
        raise _auth_error("This account is not allowed to access Nail.")

    request.state.member = member
    request.state.auth_codes = {
        "access_token": access_token_code,
        "refresh_token": request.cookies.get("refresh_token"),
    }
    return member


async def get_optional_member(request: Request) -> Optional[dict[str, Any]]:
    try:
        return await get_authenticated_member(request)
    except HTTPException:
        return None


async def require_login(request: Request) -> dict[str, Any]:
    return await get_authenticated_member(request)


def clear_auth_cookies(response) -> None:
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")


async def clear_shared_session(request: Request, member: Optional[dict[str, Any]] = None) -> None:
    redis_client = _get_optional_redis(request)
    if redis_client is None:
        return

    access_token_code = request.cookies.get("access_token") or request.headers.get("access_token")
    refresh_token_code = request.cookies.get("refresh_token")

    resolved_member = member
    if resolved_member is None:
        access_payload = await _decode_cached_token(request, "access", access_token_code)
        refresh_payload = await _decode_cached_token(request, "refresh", refresh_token_code)
        resolved_member = (access_payload or refresh_payload or {}).get("member")

    delete_keys = []
    if access_token_code:
        delete_keys.append(f"{TOKEN_PREFIX}access_{access_token_code}")
    if refresh_token_code:
        delete_keys.append(f"{TOKEN_PREFIX}refresh_{refresh_token_code}")
    if resolved_member:
        delete_keys.append(f"{LOGIN_INFO_PREFIX}{resolved_member['m_seq']}")

    if delete_keys:
        await redis_client.delete(*delete_keys)


async def consume_sso_ticket(request: Request, ticket: str) -> Optional[dict[str, Any]]:
    if not ticket:
        return None

    redis_client = _get_optional_redis(request)
    if redis_client is None:
        return None

    ticket_key = f"{SSO_TICKET_PREFIX}{SSO_SERVICE}_{ticket}"
    ticket_payload = await redis_client.get(ticket_key)
    await redis_client.delete(ticket_key)

    if not ticket_payload:
        return None

    try:
        decoded = json.loads(ticket_payload)
    except json.JSONDecodeError:
        return None

    if decoded.get("service") != SSO_SERVICE:
        return None

    return decoded


def build_cookie_options(request: Request, max_age: int) -> dict[str, Any]:
    return {
        "httponly": True,
        "max_age": max_age,
        "samesite": "lax",
        "secure": _cookie_secure(request),
        "path": "/",
    }


def build_gachon_sso_start_url(request: Request) -> str:
    base_url = os.getenv("GACHON_BASE_URL", "http://10.2.52.209").rstrip("/")
    public_base_url = os.getenv("NAIL_PUBLIC_BASE_URL", "").rstrip("/")
    callback_url = (
        f"{public_base_url}/api/auth/sso/callback"
        if public_base_url
        else str(request.url_for("auth_sso_callback"))
    )
    query = urlencode(
        {
            "service": SSO_SERVICE,
            "return_to": callback_url,
        }
    )
    return f"{base_url}/api/v2/sso/start?{query}"
