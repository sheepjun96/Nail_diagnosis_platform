import aiomysql
from typing import List, Dict, Any, Optional
from datetime import datetime, date
import json

async def get_study_list(
    conn: aiomysql.Connection,
    project_seq: Optional[int] = None,
    search: Optional[str] = None,
    filter_key: str = "name_asc",
    page: int = 1,
    rows: int = 20,
) -> Dict:

    if page < 1:
        page = 1
    if rows < 1:
        rows = 20

    offset = (page - 1) * rows

    # 정렬 기준
    order_by_map = {
        "name_asc":  "stl_patient_name ASC",
        "name_desc": "stl_patient_name DESC",
        "date_asc":  "stl_patient_studydate ASC",
        "date_desc": "stl_patient_studydate DESC",
    }
    order_by = order_by_map.get(filter_key, "stl_patient_name ASC")

    where_clauses = ["1=1"]
    params: List = []

    if project_seq is not None:
        where_clauses.append("project_seq = %s")
        params.append(project_seq)

    if search:
        where_clauses.append(
            "(stl_patient_name LIKE %s OR stl_patient_id LIKE %s)"
        )
        like = f"%{search}%"
        params.extend([like, like])

    where_sql = " AND ".join(where_clauses)

    # 1) 전체 개수
    count_sql = f"""
        SELECT COUNT(*) AS total
        FROM curaxel_skin.study_list
        WHERE {where_sql}
    """

    # 2) 실제 데이터
    data_sql = f"""
        SELECT
            stl_seq,
            project_seq,
            stl_patient_id,
            stl_patient_name,
            stl_patient_gender,
            stl_patient_birthdate,
            stl_patient_studydate,
            stl_patient_recentdate,
            stl_patient_status,
            stl_patient_tag
        FROM curaxel_skin.study_list
        WHERE {where_sql}
        ORDER BY {order_by}
        LIMIT %s OFFSET %s
    """

    async with conn.cursor(aiomysql.cursors.DictCursor) as cur:
        # total
        await cur.execute(count_sql, params)
        total_row = await cur.fetchone()
        total = total_row["total"] if total_row else 0

        # data
        params_with_paging = params + [rows, offset]
        await cur.execute(data_sql, params_with_paging)
        db_rows = await cur.fetchall()

    items = db_rows

    return {
        "items": items,
        "total": total,
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
        "create_asc": "uf_upload_date ASC",
        "create_desc": "uf_upload_date DESC",
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
            uf_upload_date,
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
            uf_upload_date,
            uf_uri,
            uf_filetype,
            uf_memo_1,
            uf_memo_2,
            uf_memo_3,
            uf_memo_4
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
    
    stl_seq = items["stl_seq"] if items else None
    return {
        "stl": stl_seq,   # 실제 데이터 목록
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

# services/resource.py

async def update_study_recentdate(
    conn: aiomysql.Connection,
    stl_seq: int,
    recent_dt: Optional[datetime],
) -> None:
    update_sql = """
        UPDATE study_list
        SET stl_patient_recentdate = %s
        WHERE stl_seq = %s
    """
    async with conn.cursor(aiomysql.DictCursor) as cur:
        await cur.execute(update_sql, (recent_dt, stl_seq))
    await conn.commit()

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

async def add_file_origin(
    conn: aiomysql.Connection,
    upload_type: str,
    upload_uri: str,
) -> Dict[str, Any]:
    
    uf_upload_write = upload_type
    uf_upload_date = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    uf_uri = upload_uri
    uf_filetype = 0
    uf_memo_1 = "o"
    uf_memo_2 = "origin"
    uf_memo_3 = ""
    uf_memo_4 = ""
    uf_del_yn = "N"
    
   
    insert_sql = """
        INSERT INTO upload_file
        (uf_upload_write, uf_upload_date, uf_uri, uf_filetype, uf_memo_1, uf_memo_2, uf_memo_3, uf_memo_4, uf_del_yn)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
    """

    insert_value = (
        uf_upload_write,
        uf_upload_date,
        uf_uri,
        uf_filetype,
        uf_memo_1,
        uf_memo_2,
        uf_memo_3,
        uf_memo_4,
        uf_del_yn
    )
    async with conn.cursor(aiomysql.DictCursor) as cur:
        await cur.execute(insert_sql, insert_value)
        insert_seq = cur.lastrowid
    await conn.commit()
    return {
        "insert_seq": insert_seq,
    }

async def add_file_crop(
    conn: aiomysql.Connection,
    upload_type: str,
    upload_uri: str,
    origin_seq : str,
    origin_uri : str,
    crop_info : str,
    ai_info : str,
    finger_index : str,
) -> Dict[str, Any]:
    
    uf_upload_write = upload_type
    uf_upload_date = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    uf_uri = upload_uri
    uf_filetype = 1
    uf_memo_1 = finger_index
    uf_memo_2 = origin_uri
    uf_memo_3 = crop_info
    uf_memo_4 = ai_info
    uf_del_yn = "N"
    
   
    insert_sql = """
        INSERT INTO upload_file
        (uf_upload_write, uf_upload_date, uf_uri, uf_filetype, uf_memo_1, uf_memo_2, uf_memo_3, uf_memo_4, uf_del_yn)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
    """

    insert_value = (
        uf_upload_write,
        uf_upload_date,
        uf_uri,
        uf_filetype,
        uf_memo_1,
        uf_memo_2,
        uf_memo_3,
        uf_memo_4,
        uf_del_yn
    )
    async with conn.cursor(aiomysql.DictCursor) as cur:
        await cur.execute(insert_sql, insert_value)
        insert_seq = cur.lastrowid
    await conn.commit()
    return {
        "insert_seq": insert_seq,
    }

async def add_file_extra(
    conn: aiomysql.Connection,
    upload_type: str,
    upload_uri: str,
    origin_seq : str,
    origin_uri : str,
    crop_info : str,
    finger_index : str,
    upload_filetype : int,
) -> Dict[str, Any]:
    
    uf_upload_write = upload_type
    uf_upload_date = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    uf_uri = upload_uri
    uf_filetype = upload_filetype
    uf_memo_1 = finger_index
    uf_memo_2 = origin_uri
    uf_memo_3 = crop_info
    uf_memo_4 = ""
    uf_del_yn = "N"
    
   
    insert_sql = """
        INSERT INTO upload_file
        (uf_upload_write, uf_upload_date, uf_uri, uf_filetype, uf_memo_1, uf_memo_2, uf_memo_3, uf_memo_4, uf_del_yn)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
    """

    insert_value = (
        uf_upload_write,
        uf_upload_date,
        uf_uri,
        uf_filetype,
        uf_memo_1,
        uf_memo_2,
        uf_memo_3,
        uf_memo_4,
        uf_del_yn
    )
    async with conn.cursor(aiomysql.DictCursor) as cur:
        await cur.execute(insert_sql, insert_value)
        insert_seq = cur.lastrowid
    await conn.commit()
    return {
        "insert_seq": insert_seq,
    }

async def get_series_list(
    conn: aiomysql.Connection,
    patient_id: str,
) -> Dict:
    async with conn.cursor(aiomysql.cursors.DictCursor) as cur:
        # 1) patient_id -> stl_seq
        await cur.execute(
            """
            SELECT stl_seq
            FROM curaxel_skin.study_list
            WHERE stl_patient_id = %s
            """,
            (patient_id,),
        )
        row = await cur.fetchone()
        if not row:
            return {"code": 200, "message": "OK", "context": []}

        stl_seq = row["stl_seq"]

        # 2) stl_seq 기준으로 series_list 조회
        await cur.execute(
            """
            SELECT
                srl_seq,
                stl_seq,
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
                srl_patient_r_p
            FROM curaxel_skin.series_list
            WHERE stl_seq = %s
            ORDER BY srl_patient_seriesdate DESC
            """,
            (stl_seq,),
        )
        rows = await cur.fetchall()

    # 3) No/instance 계산
    series_items = []
    for idx, r in enumerate(rows, start=1):
        fingers = [
            r["srl_patient_l_t"],
            r["srl_patient_l_i"],
            r["srl_patient_l_m"],
            r["srl_patient_l_R"],
            r["srl_patient_l_p"],
            r["srl_patient_r_t"],
            r["srl_patient_r_i"],
            r["srl_patient_r_m"],
            r["srl_patient_r_R"],
            r["srl_patient_r_p"],
        ]
        # 빈 JSON(입력 안 된 경우)와 실제 입력 구분: origin 이 비어 있지 않은 것만 카운트
        instance_cnt = 0
        for f in fingers:
            if not f:
                continue
            try:
                j = json.loads(f)
                if j.get("origin"):
                    instance_cnt += 1
            except Exception:
                # 혹시 포맷이 달라도 일단 1개로 취급
                instance_cnt += 1

        series_items.append({
            "no": idx,
            "date": r["srl_patient_seriesdate"],
            "instance": instance_cnt,
            "srl_seq": r["srl_seq"],
        })

    return {
        "code": 200,
        "message": "OK",
        "context": series_items,
    }

async def get_series_detail(
    conn: aiomysql.Connection,
    stl_seq: int,
    srl_seq: int,
) -> Dict[str, Any]:
    async with conn.cursor(aiomysql.cursors.DictCursor) as cur:
        await cur.execute(
            """
            SELECT
                srl_seq,
                stl_seq,
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
                srl_patient_r_p
            FROM curaxel_skin.series_list
            WHERE stl_seq = %s
              AND srl_seq = %s
            LIMIT 1
            """,
            (stl_seq, srl_seq),
        )
        row = await cur.fetchone()

    if not row:
        return {"code": 404, "message": "Series not found", "context": None}

    return {"code": 200, "message": "OK", "context": row}

async def delete_series_data(conn: aiomysql.Connection, srl_seq: int, stl_seq: int):
    try:
        async with conn.cursor() as cur:
            sql = "DELETE FROM series_list WHERE srl_seq = %s AND stl_seq = %s"
            await cur.execute(sql, (srl_seq, stl_seq))
            await conn.commit()
            return True
    except Exception as e:
        print(f"Error deleting series: {e}")
        return False

async def delete_study_if_empty(conn: aiomysql.Connection, stl_seq: int):
    try:
        async with conn.cursor() as cur:
            check_sql = "SELECT COUNT(*) FROM series_list WHERE stl_seq = %s"
            await cur.execute(check_sql, (stl_seq,))
            (count,) = await cur.fetchone()

            if count > 0:
                return {"ok": False, "msg": f"Cannot delete. This patient still has {count} series."}

            del_sql = "DELETE FROM study_list WHERE stl_seq = %s"
            await cur.execute(del_sql, (stl_seq,))
            await conn.commit()
            return {"ok": True}
    except Exception as e:
        print(f"Error deleting patient: {e}")
        return {"ok": False, "msg": "Database error occurred."}