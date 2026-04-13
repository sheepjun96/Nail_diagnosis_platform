from typing import Optional

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse, RedirectResponse

from auth import (
    APP_HOME_PATH,
    APP_LOGIN_PATH,
    AUTH_COOKIE_MAX_AGE,
    REFRESH_COOKIE_MAX_AGE,
    build_cookie_options,
    build_gachon_sso_start_url,
    clear_auth_cookies,
    clear_shared_session,
    consume_sso_ticket,
    get_authenticated_member,
    get_optional_member,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.get("/login")
async def auth_login(request: Request):
    return RedirectResponse(build_gachon_sso_start_url(request), status_code=302)


@router.get("/sso/callback", name="auth_sso_callback")
async def auth_sso_callback(request: Request, ticket: Optional[str] = None):
    payload = await consume_sso_ticket(request, ticket or "")
    if not payload:
        return RedirectResponse(APP_LOGIN_PATH, status_code=302)

    response = RedirectResponse(APP_HOME_PATH, status_code=302)
    response.set_cookie(
        "access_token",
        payload["accessTokenCode"],
        **build_cookie_options(request, AUTH_COOKIE_MAX_AGE),
    )
    response.set_cookie(
        "refresh_token",
        payload["refreshTokenCode"],
        **build_cookie_options(request, REFRESH_COOKIE_MAX_AGE),
    )
    return response


@router.get("/me")
async def auth_me(member=Depends(get_authenticated_member)):
    return {
        "status": "success",
        "member": {
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
            "last_login_date": (
                str(member.get("last_login_date")) if member.get("last_login_date") else None
            ),
            "password_expiry_date": (
                str(member.get("password_expiry_date")) if member.get("password_expiry_date") else None
            ),
        },
    }


@router.post("/logout")
async def auth_logout(request: Request):
    member = await get_optional_member(request)
    await clear_shared_session(request, member)

    response = JSONResponse({"status": "success", "message": "Logged out"})
    clear_auth_cookies(response)
    return response
