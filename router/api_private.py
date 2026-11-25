from fastapi import APIRouter

from router.models.resource import router as resource_api
from router.models.resource_viewer import router as resource_viewer_api

router = APIRouter(prefix="/api", tags=["resources"])
router.include_router(resource_api)
router.include_router(resource_viewer_api)
