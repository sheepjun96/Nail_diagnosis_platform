import aiomysql
from typing import List, Dict, Any, Optional, Tuple
from test.dumy_data import RESOURCE_STUDY_LIST
from datetime import datetime, date
import json

async def get_study_list(
    conn: aiomysql.Connection,
    project_seq: Optional[str] = None,
    search: Optional[str] = None,
    filter_key: str = "name_asc",
    page: int = 1,
    rows: int = 20,
) -> List[Dict]:
    
    items = RESOURCE_STUDY_LIST
    total = len(items)

    if page < 1:
        page = 1
    if rows < 1:
        rows = 20

    start = (page - 1) * rows
    end = start + rows

    paginated_items = items[start:end]

    # 6) 결과 포맷
    return {
        "items": paginated_items,   # 실제 데이터 목록
        "total": total,   # 전체 개수
        "page": page,
        "rows": rows,
    }


async def get_image_origin_list(
    conn: aiomysql.Connection,
    image_type : Optional[int] = None,
    search: Optional[str] = None,
    filter_key: str = "filename_asc",
    page: int = 1,
    rows: int = 20,
) -> List[Dict]:
    order_map = {
        "filename_asc": "uf_uri ASC",
        "filename_desc": "uf_uri DESC",
        "create_asc": "up_upload_date ASC",
        "create_desc": "up_upload_date DESC",
    }
    order_by = order_map.get(filter_key, "uf_uri ASC")  # 기본값: 이름 오름차순

    # 2) page, rows 안전 처리
    if page < 1:
        page = 1
    if rows < 1:
        rows = 20
    offset = (page - 1) * rows

    
    where_clauses = ["(uf_del_yn = 'N')"]
    params: List[Any] = []

    if image_type is not None:
        where_clauses.append("(uf_filetype = %s)")
        params.extend([image_type])

    if search:
        where_clauses.append("(uf_uri LIKE %s)")
        like = f"%{search}%"
        params.extend([like])

    where_sql = " AND ".join(where_clauses)

    count_sql = f"""
        SELECT COUNT(*) AS total
        FROM upload_file
        WHERE {where_sql}
    """
    
    async with conn.cursor(aiomysql.DictCursor) as cur:
        await cur.execute(count_sql, params)
        count_row = await cur.fetchone()
        total = count_row["total"] if count_row else 0

    list_sql = f"""
        SELECT 
            uf_seq,
            uf_upload_write,
            up_upload_date,
            uf_uri,
            uf_filetype,
            uf_memo_1,
            uf_memo_2
        FROM upload_file
        WHERE {where_sql}
        ORDER BY {order_by}
        LIMIT %s OFFSET %s
    """
    list_params = params + [rows, offset]
    
    async with conn.cursor(aiomysql.DictCursor) as cur:
        await cur.execute(list_sql, list_params)
        items = await cur.fetchall()

    # 6) 결과 포맷
    return {
        "items": items,   # 실제 데이터 목록
        "total": total,   # 전체 개수
        "page": page,
        "rows": rows,
    }

async def get_image_origin_detail(
    conn: aiomysql.Connection,
    filename: Optional[str] = None,
    page: int = 1,
    rows: int = 20,
) -> Dict[str, Any]:
    
    params: List[Any] = []
    where_sql = "( uf_memo_2 LIKE %s OR uf_uri LIKE %s )"
    like = f"{filename}" if filename else "%"
    params.extend([like, like])
    detail_sql = f"""
        SELECT 
            uf_seq,
            uf_upload_write,
            up_upload_date,
            uf_uri,
            uf_filetype,
            uf_memo_1,
            uf_memo_2
        FROM upload_file
        WHERE {where_sql}
        ORDER BY uf_filetype ASC
    """
    
    async with conn.cursor(aiomysql.DictCursor) as cur:
        await cur.execute(detail_sql, params)
        items = await cur.fetchall()

    # 6) 결과 포맷
    return {
        "items": items,   # 실제 데이터 목록
    }

async def get_study_List_patientId(
    conn: aiomysql.Connection,
    patient_id: Optional[str] = None
) -> Dict[str, Any]:
    select_study_sql = """
        SELECT stl_seq
        FROM study_list
        WHERE stl_patient_id = %s
        ORDER BY stl_patient_recentdate DESC
        LIMIT 1
    """
    async with conn.cursor(aiomysql.DictCursor) as cur:
        await cur.execute(select_study_sql, [patient_id])
        items = await cur.fetchone()
    return {
        "stl": items["stl_seq"],   # 실제 데이터 목록
    }

async def add_study(
    conn: aiomysql.Connection,
    project_seq: int,
    patient_id: str,
    patient_name: str,
    patient_gender: str,
    patient_birth: Optional[date] = None,         # "YYYY-MM-DD" 문자열을 그대로 넘겨도 됨
    patient_visit: Optional[datetime] = None,     # datetime 또는 None
) -> Dict[str, Any]:
    insert_study_sql = """
        INSERT INTO study_list
        (project_seq,
            stl_patient_id,
            stl_patient_name,
            stl_patient_gender,
            stl_patient_birthdate,
            stl_patient_studydate,
            stl_patient_recentdate)
        VALUES (%s,%s,%s,%s,%s,%s,%s)
    """
    insert_value = (
        project_seq,
        patient_id,
        patient_name,
        patient_gender,
        patient_birth,
        patient_visit,
        patient_visit
    )
    async with conn.cursor(aiomysql.DictCursor) as cur:
        await cur.execute(insert_study_sql, insert_value)
        stl_seq = cur.lastrowid
    await conn.commit()
    return {
        "stl_seq": stl_seq,
    }

async def add_seires(
    conn: aiomysql.Connection,
    stl_seq: int,
    series_dt: datetime,
    series_note: str,
    nail_data: Dict[str, Any],
) -> Dict[str, Any]:
    
    def nail_json(key: str) -> str:
        # 없으면 {} 을 기본으로
        return json.dumps(nail_data.get(key, {}), ensure_ascii=False)
    insert_series_sql = """
        INSERT INTO series_list
        (stl_seq,
         srl_patient_seriesdate,
         srl_patient_note,
         srl_patient_l_t,
         srl_patient_l_i,
         srl_patient_l_m,
         srl_patient_l_R,
         srl_patient_l_p,
         srl_patient_r_t,
         srl_patient_r_i,
         srl_patient_r_m,
         srl_patient_r_R,
         srl_patient_r_p)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
    """
    insert_value = (
        stl_seq,
        series_dt,
        series_note,
        nail_json("patient_l_t"),
        nail_json("patient_l_i"),
        nail_json("patient_l_m"),
        nail_json("patient_l_r"),
        nail_json("patient_l_p"),
        nail_json("patient_r_t"),
        nail_json("patient_r_i"),
        nail_json("patient_r_m"),
        nail_json("patient_r_r"),
        nail_json("patient_r_p"),
    )
    async with conn.cursor(aiomysql.DictCursor) as cur:
        await cur.execute(insert_series_sql, insert_value)
        srl_seq = cur.lastrowid
    await conn.commit()
    return {
        "srl_seq": srl_seq,
    }