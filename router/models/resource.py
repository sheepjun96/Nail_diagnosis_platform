# api_public.py
import os
from datetime import datetime
from fastapi import APIRouter, Request, Form, UploadFile, File, Depends, Query
from fastapi.responses import HTMLResponse, RedirectResponse, JSONResponse

from config import CONFIG_DIR
from typing import List, Optional
import aiomysql
from db import get_conn
from router.services.resource import get_study_list
from router.services.resource import get_image_origin_list

router = APIRouter(prefix="/resource", tags=["resource"])
SAVE_NAIL_DIR = CONFIG_DIR["nail"]

@router.get("/health", response_class=JSONResponse)
def health_check(
    request: Request
):
    return {"code" : 200, "state": "ok", "msg" : "api router OK"}

# Study List
@router.get("/study/list", response_class=JSONResponse)
async def study_list(
    request: Request,
    project_seq : Optional[int] = Query(None, description="프로젝트 seq"),
    search: Optional[str] = Query(None, description="이름/이메일 검색어"),
    filter: str = Query("name_asc", description="patientid_asc, patientid_desc, patientname_asc, patientname_desc, imported_asc, imported_desc, study_asc, study_desc"),
    page: int = Query(1, ge=1, description="현재 페이지 (1부터 시작)"),
    rows: int = Query(20, ge=1, description="페이지당 row 수"),
    conn: aiomysql.Connection = Depends(get_conn),
):
    result = await get_study_list(
        conn=conn,
        project_seq=project_seq,
        search=search,
        filter_key=filter,
        page=page,
        rows=rows,
    )

    return {
        "code" : 200, 
        "state": "ok",
        "context" : result["items"],
        "total": result["total"], 
        "page": result["page"],
        "rows": result["rows"],
    }

# Study List
@router.get("/image/origin/list", response_class=JSONResponse)
async def image_origin_list(
    request: Request,
    image_type : Optional[int] = None,
    search: Optional[str] = Query(None, description="파일이름 검색어"),
    filter: str = Query("filename_asc", description="filename_asc, filename_desc, create_asc, create_desc"),
    page: int = Query(1, ge=1, description="현재 페이지 (1부터 시작)"),
    rows: int = Query(20, ge=1, description="페이지당 row 수"),
    conn: aiomysql.Connection = Depends(get_conn),
):
    result = await get_image_origin_list(
        conn=conn,
        image_type = image_type,
        search=search,
        filter_key=filter,
        page=page,
        rows=rows,
    )

    return {
        "code" : 200, 
        "state": "ok",
        "context" : result["items"],
        "total": result["total"], 
        "page": result["page"],
        "rows": result["rows"],
    }