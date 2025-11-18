# api_public.py
import os
from datetime import datetime
from fastapi import APIRouter, Request, Form, UploadFile, File, Depends, Query
from fastapi.responses import HTMLResponse, RedirectResponse, JSONResponse

from config import CONFIG_DIR
from typing import List, Optional
import aiomysql
from db import get_conn
from router.services.member import get_member_list

router = APIRouter(prefix="/member", tags=["member"])
SAVE_NAIL_DIR = CONFIG_DIR["nail"]

@router.get("/health", response_class=JSONResponse)
def health_check(
    request: Request
):
    return {"code" : 200, "state": "ok", "msg" : "api router OK"}

# Member
@router.get("/list", response_class=JSONResponse)
async def member_list(
    request: Request,
    mr_seq: Optional[str] = Query(None, description="권한/역할 seq"),
    search: Optional[str] = Query(None, description="이름/이메일 검색어"),
    filter: str = Query("name_asc", description="name_asc, name_desc, email_asc, email_desc, upd_asc, upd_desc"),
    page: int = Query(1, ge=1, description="현재 페이지 (1부터 시작)"),
    rows: int = Query(20, ge=1, description="페이지당 row 수"),
    conn: aiomysql.Connection = Depends(get_conn),
):
    result = await get_member_list(
        conn=conn,
        mr_seq=mr_seq,
        search=search,
        filter_key=filter,
        page=page,
        rows=rows,
    )

    return {
        "code": 200,
        "state": "ok",
        "context": result["items"],
        "total": result["total"],
        "page": result["page"],
        "rows": result["rows"],
    }

# Meber Role
@router.get("/role/list", response_class=JSONResponse)
async def get_member_role_list(request: Request):
    return {
        "code" : 200, 
        "state": "ok",
        "context" : [
            {
                "mr_seq" : 0,
                "mr_name" : "Root",
                "mr_upd_date" : "2025-11-17 09:40:00"
            },{
                "mr_seq" : 1,
                "mr_name" : "System Admin",
                "mr_upd_date" : "2025-11-17 09:40:00"
            },{
                "mr_seq" : 2,
                "mr_name" : "Project Manager",
                "mr_upd_date" : "2025-11-17 09:40:00"
            },{
                "mr_seq" : 3,
                "mr_name" : "Reader",
                "mr_upd_date" : "2025-11-17 09:40:00"
            },{
                "mr_seq" : 4,
                "mr_name" : "Researcher",
                "mr_upd_date" : "2025-11-17 09:40:00"
            },{
                "mr_seq" : 99,
                "mr_name" : "User",
                "mr_upd_date" : "2025-11-17 09:40:00"
            }
        ]
    }