# api_public.py
import os, io
from fastapi import APIRouter, Request, Form, UploadFile, File, Depends, Query, HTTPException
from fastapi.responses import JSONResponse, FileResponse, StreamingResponse
from PIL import Image
import json
import mimetypes
from config import CONFIG_DIR
from typing import List, Optional
import aiomysql
from auth import ensure_role
from db import get_conn
from router.services.resource import get_study_list, get_study_List_patientId, add_study, add_seires, get_series_list, get_series_detail, update_series_data
from router.services.resource import get_image_origin_list, get_image_origin_detail, update_study_recentdate
from router.services.resource import delete_series_data, delete_study_if_empty
from router.services.resource_viewer import update_study_patient

router = APIRouter(prefix="/resource", tags=["resource"])
SAVE_NAIL_DIR = CONFIG_DIR["nail"]
SAVE_EXTRA_DIR = CONFIG_DIR["extra"]

WORKLIST_VIEW_ROLES = [1, 2, 3, 4, 5, 6, 9, 10]
ADD_PATIENT_ROLES = [1, 2, 3]
EDIT_ROLES = [1, 2, 3, 4, 5, 6, 9]
DELETE_SERIES_ROLES = [1, 2, 3, 4]
DELETE_PATIENT_ROLES = [1, 2]


async def apply_uploaded_extras(data: dict, file_map: dict):
    nail_dict = data.get("nail", {})

    def build_extra_url(filename: str) -> str:
        return f"/api/resource/image/dump?filename={filename}&filetype=2"

    for nail_key, files in file_map.items():
        if not files:
            continue

        saved_urls: list[str] = []

        for upload in files:
            if not upload.filename:
                continue

            _, ext = os.path.splitext(upload.filename)
            if not ext:
                ext = ".png"
            cvt_filename = f"extra_{upload.filename}"
            safe_filename = f"{cvt_filename}"
            save_path = os.path.join(SAVE_EXTRA_DIR, safe_filename)

            content = await upload.read()
            with open(save_path, "wb") as f:
                f.write(content)

            saved_urls.append(build_extra_url(safe_filename))

        if nail_key not in nail_dict:
            nail_dict[nail_key] = {}

        nail_dict[nail_key]["extra"] = saved_urls

    data["nail"] = nail_dict
    return data

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
    ensure_role(request.state.member, WORKLIST_VIEW_ROLES, "study list")

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
    ensure_role(request.state.member, WORKLIST_VIEW_ROLES, "image origin list")

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
    ensure_role(request.state.member, WORKLIST_VIEW_ROLES, "image origin detail")

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

@router.get("/image/dump")
async def image_origin_detail(
    request: Request,
    filename: str = Query(..., description="filename"),
    filetype: int = Query(..., description="filetype"),
    width: Optional[int] = Query(None, description="width (px)"),
    conn: aiomysql.Connection = Depends(get_conn),
):
    ensure_role(request.state.member, WORKLIST_VIEW_ROLES, "image dump")

    safe_name = os.path.basename(filename)

    if filetype == 0: base_dir = CONFIG_DIR["nail"]
    elif filetype == 1: base_dir = CONFIG_DIR["crop"]
    else: base_dir = CONFIG_DIR["extra"]

    file_path = os.path.join(base_dir, safe_name)

    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Image not found")

    if width and width > 0:
        try:
            img = Image.open(file_path)
            if hasattr(img, '_getexif'):
                from PIL import ImageOps
                img = ImageOps.exif_transpose(img)

            img.thumbnail((width, width), Image.Resampling.LANCZOS)
            
            buf = io.BytesIO()
            ext = os.path.splitext(safe_name)[1].lower()
            img_format = "PNG" if ext == ".png" else "JPEG"
            img.save(buf, format=img_format, quality=80)
            buf.seek(0)
            
            return StreamingResponse(buf, media_type=f"image/{img_format.lower()}")
        except Exception as e:
            print(f"Resizing Error: {e}")

    media_type, _ = mimetypes.guess_type(file_path)
    return FileResponse(file_path, media_type=media_type or "image/jpeg")

@router.get("/image/extra")
async def image_extra(
    request: Request,
    filename: str = Query(..., description="filename"),
    filetype: int = Query(2, description="filetype (default 2)"),
    conn: aiomysql.Connection = Depends(get_conn),
):
    ensure_role(request.state.member, WORKLIST_VIEW_ROLES, "image extra")

    return await image_origin_detail(
        request=request,
        filename=filename,
        filetype=filetype,
        conn=conn,
    )

@router.post("/patient/add")
async def add_patient(
    request: Request,
    body: str = Form(...),  # "body" 필드(JSON 문자열)
    patient_l_t: List[UploadFile] = File([]),
    patient_l_i: List[UploadFile] = File([]),
    patient_l_m: List[UploadFile] = File([]),
    patient_l_r: List[UploadFile] = File([]),
    patient_l_p: List[UploadFile] = File([]),
    patient_r_t: List[UploadFile] = File([]),
    patient_r_i: List[UploadFile] = File([]),
    patient_r_m: List[UploadFile] = File([]),
    patient_r_r: List[UploadFile] = File([]),
    patient_r_p: List[UploadFile] = File([]),
    conn: aiomysql.Connection = Depends(get_conn),
):
    ensure_role(request.state.member, ADD_PATIENT_ROLES, "add patient")

    data = json.loads(body)

    file_map = {
        "patient_l_t": patient_l_t,
        "patient_l_i": patient_l_i,
        "patient_l_m": patient_l_m,
        "patient_l_r": patient_l_r,
        "patient_l_p": patient_l_p,
        "patient_r_t": patient_r_t,
        "patient_r_i": patient_r_i,
        "patient_r_m": patient_r_m,
        "patient_r_r": patient_r_r,
        "patient_r_p": patient_r_p,
    }

    data = await apply_uploaded_extras(data, file_map)

    add_type = data.get("addType", "new")  # "exist" 또는 그 외
    project_seq = data.get("projectSeq", 1)

    patient_id = data.get("patientId", "")
    patient_name = data.get("patientName", "")
    patient_gender = data.get("patientGender", "")
    patient_birth = data.get("patientBirth") or None           # "YYYY-MM-DD"
    patient_visit = data.get("patientVisit") or None           # "YYYY-MM-DDTHH:MM"

    stl_seq = None
    if add_type == "exist":
        exist_result = await get_study_List_patientId(patient_id=patient_id, conn=conn)
        print("exist_result", exist_result)
        stl_seq = exist_result["stl"]
        if not stl_seq:
            add_result = await add_study(
                project_seq=project_seq,
                patient_id= patient_id,
                patient_name=patient_name,
                patient_gender=patient_gender,
                patient_birth=patient_birth,
                patient_visit=patient_visit, 
                conn=conn
            )
            stl_seq = add_result["stl_seq"]
    else :
        add_result = await add_study(
            project_seq=project_seq,
            patient_id= patient_id,
            patient_name=patient_name,
            patient_gender=patient_gender,
            patient_birth=patient_birth,
            patient_visit=patient_visit, 
            conn=conn
        )
        stl_seq = add_result["stl_seq"]
    
    if not stl_seq:
        raise HTTPException(status_code=404, detail="Study not exist")
    
    series_note = data.get("patientNote", "")
    series_dt = patient_visit
    nail_data = data.get("nail", {})

    series_result = await add_seires(
        stl_seq=stl_seq,
        series_note = series_note,
        series_dt = series_dt,
        nail_data = nail_data,
        conn=conn
    )
    srl_seq = series_result["srl_seq"]

    if not srl_seq:
        raise HTTPException(status_code=404, detail="Series not exist")
    
    await update_study_recentdate(
        conn=conn,
        stl_seq=stl_seq,
        recent_dt=series_dt
    )

    return {
        "ok": True,
        "data": {
            stl_seq : stl_seq,
            srl_seq : srl_seq
        },
    }

@router.post("/series/modify")
async def modify_series(
    request: Request,
    body: str = Form(...),
    patient_l_t: List[UploadFile] = File([]),
    patient_l_i: List[UploadFile] = File([]),
    patient_l_m: List[UploadFile] = File([]),
    patient_l_r: List[UploadFile] = File([]),
    patient_l_p: List[UploadFile] = File([]),
    patient_r_t: List[UploadFile] = File([]),
    patient_r_i: List[UploadFile] = File([]),
    patient_r_m: List[UploadFile] = File([]),
    patient_r_r: List[UploadFile] = File([]),
    patient_r_p: List[UploadFile] = File([]),
    conn: aiomysql.Connection = Depends(get_conn),
):
    ensure_role(request.state.member, EDIT_ROLES, "modify series")

    data = json.loads(body)

    file_map = {
        "patient_l_t": patient_l_t,
        "patient_l_i": patient_l_i,
        "patient_l_m": patient_l_m,
        "patient_l_r": patient_l_r,
        "patient_l_p": patient_l_p,
        "patient_r_t": patient_r_t,
        "patient_r_i": patient_r_i,
        "patient_r_m": patient_r_m,
        "patient_r_r": patient_r_r,
        "patient_r_p": patient_r_p,
    }

    data = await apply_uploaded_extras(data, file_map)

    stl_seq = data.get("stl_seq")
    srl_seq = data.get("srl_seq")

    if not stl_seq or not srl_seq:
      raise HTTPException(status_code=400, detail="stl_seq and srl_seq are required")

    patient_id = data.get("patientId", "")
    patient_name = data.get("patientName", "")
    patient_gender = data.get("patientGender", "")
    patient_birth = data.get("patientBirth") or None
    patient_visit = data.get("patientVisit") or None
    series_note = data.get("patientNote", "")
    nail_data = data.get("nail", {})

    await update_study_patient(
        conn=conn,
        stl_seq=stl_seq,
        patient_id=patient_id,
        patient_name=patient_name,
        patient_gender=patient_gender,
        patient_birthdate=patient_birth,
    )

    series_result = await update_series_data(
        conn=conn,
        stl_seq=stl_seq,
        srl_seq=srl_seq,
        series_dt=patient_visit,
        series_note=series_note,
        nail_data=nail_data,
    )

    return {
        "ok": True,
        "data": {
            "stl_seq": stl_seq,
            "srl_seq": series_result["srl_seq"],
        },
    }

# Series List
@router.get("/series/list", response_class=JSONResponse)
async def series_list(
    request: Request,
    patient_id: str = Query(..., description="환자 Patient ID"),
    conn: aiomysql.Connection = Depends(get_conn),
):
    # patient_id 를 받아서 해당 환자의 series_list 를 반환
    ensure_role(request.state.member, WORKLIST_VIEW_ROLES, "series list")

    result = await get_series_list(
        conn=conn,
        patient_id=patient_id,
    )

    return {
        "code": result.get("code", 200),
        "state": "ok",
        "message": result.get("message", "OK"),
        "context": result.get("context", []),
    }

@router.get("/series/detail", response_class=JSONResponse)
async def series_detail(
    request: Request,
    stl_seq: int = Query(..., description="study_list.stl_seq"),
    srl_seq: int = Query(..., description="series_list.srl_seq"),
    conn: aiomysql.Connection = Depends(get_conn),
):
    ensure_role(request.state.member, WORKLIST_VIEW_ROLES, "series detail")

    result = await get_series_detail(
        conn=conn,
        stl_seq=stl_seq,
        srl_seq=srl_seq,
    )
    return {
        "code": result.get("code", 200),
        "state": "ok",
        "message": result.get("message", "OK"),
        "context": result.get("context"),
    }

@router.post("/series/delete")
async def delete_series_api(
    request: Request,
    body: dict,
    conn: aiomysql.Connection = Depends(get_conn)
):
    ensure_role(request.state.member, DELETE_SERIES_ROLES, "delete series")

    srl_seq = body.get("srl_seq")
    stl_seq = body.get("stl_seq")
    success = await delete_series_data(conn, srl_seq, stl_seq)
    return {"ok": success}

@router.post("/patient/delete_empty")
async def delete_empty_patient_api(
    request: Request,
    body: dict,
    conn: aiomysql.Connection = Depends(get_conn)
):
    ensure_role(request.state.member, DELETE_PATIENT_ROLES, "delete patient")

    stl_seq = body.get("stl_seq")
    result = await delete_study_if_empty(conn, stl_seq)
    return result
