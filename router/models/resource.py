# api_public.py
import os
from datetime import datetime
from fastapi import APIRouter, Request, Form, UploadFile, File, Depends, Query, HTTPException
from fastapi.responses import HTMLResponse, RedirectResponse, JSONResponse, FileResponse

import mimetypes
from config import CONFIG_DIR
from typing import List, Optional
import aiomysql
from db import get_conn
from router.services.resource import get_study_list
from router.services.resource import get_image_origin_list, get_image_origin_detail

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

@router.get("/image/origin/detail", response_class=JSONResponse)
async def image_origin_detail(
    request: Request,
    filename: Optional[str] = Query(None, description="파일이름 검색어"),
    conn: aiomysql.Connection = Depends(get_conn),
):
    result = await get_image_origin_detail(
        conn=conn,
        filename = filename,
    )

    return {
        "code" : 200, 
        "state": "ok",
        "context" : result["items"],
        "base" : "/api/resource/image/dump"
    }

@router.get("/image/dump", response_class=JSONResponse)
async def image_origin_detail(
    request: Request,
    filename: Optional[str] = Query(None, description="파일이름"),
    filetype: Optional[int] = Query(None, description="파일타입"),
    conn: aiomysql.Connection = Depends(get_conn),
):
    # 1) filename 검증
    if not filename:
        raise HTTPException(status_code=400, detail="filename is required")

    # 디렉토리 탈출 공격 방지: 경로에서 파일명만 추출
    safe_name = os.path.basename(filename)

    # 2) filetype 에 따른 폴더 결정
    if filetype == 0:
        base_dir = CONFIG_DIR["nail"]
    elif filetype == 1:
        base_dir = CONFIG_DIR["crop"]
    else:
        base_dir = CONFIG_DIR["extra"]

    file_path = os.path.join(base_dir, safe_name)

    print("file_path", file_path)

    # 3) 파일 존재 여부 확인
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Image not found")

    # 4) MIME 타입 추론 (jpg, png 등 확장자에 따라)
    media_type, _ = mimetypes.guess_type(file_path)
    if media_type is None:
        media_type = "image/jpeg"  # 기본값

    # 5) 파일 응답 반환
    return FileResponse(file_path, media_type=media_type)