from fastapi import APIRouter, Request, Form, Depends, Query
from fastapi.responses import JSONResponse
from config import CONFIG_DIR
from typing import Optional
import aiomysql
from auth import ensure_role
from db import get_conn
from router.services.resource_viewer import get_viewer_info, update_study_patient, get_series_note, update_series_note, get_filtered_series_list

router = APIRouter(prefix="/resource", tags=["resource_viewer"])
SAVE_NAIL_DIR = CONFIG_DIR["nail"]
SAVE_EXTRA_DIR = CONFIG_DIR["extra"]

VIEWER_ROLES = [1, 2, 3, 4, 5, 6, 9, 10]
VIEWER_EDIT_ROLES = [1, 2, 3, 4, 5, 6, 9]

@router.get("/viewer/info", response_class=JSONResponse)
async def viewer_info(
    request: Request,
    stl_seq: int = Query(..., description="study_list.stl_seq"),
    conn: aiomysql.Connection = Depends(get_conn),
):
    
    ensure_role(request.state.member, VIEWER_ROLES, "viewer info")

    result = await get_viewer_info(conn=conn, stl_seq=stl_seq)
    return {
        "code": result.get("code", 200),
        "state": "ok",
        "message": result.get("message", "OK"),
        "context": result.get("context"),
    }

@router.post("/viewer/patient/modify", response_class=JSONResponse)
async def viewer_patient_modify(
    request: Request,
    stl_seq: int = Form(...),
    patient_id: str = Form(...),
    patient_name: str = Form(...),
    patient_gender: str = Form(...),
    patient_birth: Optional[str] = Form(None),  # "YYYY-MM-DD"
    conn: aiomysql.Connection = Depends(get_conn),
):
    ensure_role(request.state.member, VIEWER_EDIT_ROLES, "viewer patient modify")

    result = await update_study_patient(
        conn=conn,
        stl_seq=stl_seq,
        patient_id=patient_id,
        patient_name=patient_name,
        patient_gender=patient_gender,
        patient_birthdate=patient_birth,
    )
    return {
        "code": result.get("code", 200),
        "state": "ok",
        "message": result.get("message", "OK"),
    }

@router.get("/viewer/series_note", response_class=JSONResponse)
async def viewer_series_note(
    request: Request,
    stl_seq: int = Query(...),
    srl_seq: int = Query(...),
    conn: aiomysql.Connection = Depends(get_conn),
):
    ensure_role(request.state.member, VIEWER_ROLES, "viewer series note")

    result = await get_series_note(conn, stl_seq, srl_seq)
    return result

@router.post("/viewer/update_series_note", response_class=JSONResponse)
async def update_viewer_series_note(
    request: Request,
    stl_seq: int = Form(...),
    srl_seq: int = Form(...),
    note: str = Form(...),
    conn: aiomysql.Connection = Depends(get_conn),
):
    ensure_role(request.state.member, VIEWER_EDIT_ROLES, "viewer update series note")

    result = await update_series_note(conn, stl_seq, srl_seq, note)
    return result

@router.get("/viewer/series/list", response_class=JSONResponse)
async def api_get_series_list(
    request: Request,
    stl_seq: int = Query(...),
    search: str = Query(""),
    conn: aiomysql.Connection = Depends(get_conn)
):
    ensure_role(request.state.member, VIEWER_ROLES, "viewer series list")

    result = await get_filtered_series_list(conn, stl_seq, search)
    return {
        "code": result["code"],
        "state": "ok",
        "context": result["context"]
    }
