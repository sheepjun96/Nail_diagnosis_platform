"""The web API has no torch/transformers imports or model weights."""

import os

import httpx
from fastapi import HTTPException

from config import settings


def create_ai_client():
    token = os.getenv("NAIL_INTERNAL_API_TOKEN", "")
    if not token:
        raise RuntimeError("NAIL_INTERNAL_API_TOKEN must be configured.")
    return httpx.AsyncClient(
        base_url=settings.ai_url,
        headers={"Authorization": f"Bearer {token}"},
        timeout=float(settings.value("ai", "timeout_seconds", 600, "NAIL_AI_TIMEOUT")),
        limits=httpx.Limits(max_connections=8, max_keepalive_connections=4),
        trust_env=False,
    )


async def call_ai(request, action, payload, *, image_response=False):
    try:
        response = await request.app.state.ai_client.post(f"/v1/{action}", json=payload)
    except httpx.TimeoutException as exc:
        raise HTTPException(504, "AI analysis timed out.") from exc
    except httpx.HTTPError as exc:
        raise HTTPException(503, "AI analysis service is unavailable.") from exc
    if response.is_error:
        detail = "AI analysis failed."
        try:
            detail = response.json().get("detail", detail)
        except ValueError:
            pass
        raise HTTPException(response.status_code if response.status_code in {400, 404, 409, 422, 429, 503} else 502, detail)
    return response.content if image_response else response.json()
