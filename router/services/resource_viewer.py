import aiomysql
from typing import List, Dict, Any, Optional, Tuple

async def get_viewer_info(
    conn: aiomysql.Connection,
    stl_seq: int,
) -> Dict[str, Any]:
    """
    viewer 화면용 Patient Info 조회
    - type: 해당 stl_seq 의 series 개수 = 1 → "New", 그 외 → "Exist"
    - 나머지 필드는 study_list 에서 가져옴
    """
    async with conn.cursor(aiomysql.cursors.DictCursor) as cur:
        # 1) study_list 기본 정보
        await cur.execute(
            """
            SELECT
                stl_seq,
                stl_patient_id,
                stl_patient_name,
                stl_patient_gender,
                stl_patient_birthdate,
                stl_patient_recentdate
            FROM curaxel_skin.study_list
            WHERE stl_seq = %s
            """,
            (stl_seq,),
        )
        study = await cur.fetchone()
        if not study:
            return {"code": 404, "message": "Study not found", "context": None}

        # 2) 해당 stl_seq 의 series 개수
        await cur.execute(
            """
            SELECT COUNT(*) AS cnt
            FROM curaxel_skin.series_list
            WHERE stl_seq = %s
            """,
            (stl_seq,),
        )
        row = await cur.fetchone()
        series_cnt = row["cnt"] if row else 0

    type_value = "New" if series_cnt == 1 else "Exist"

    info = {
        "type": type_value,
        "patient_id": study["stl_patient_id"],
        "patient_name": study["stl_patient_name"],
        "patient_gender": study["stl_patient_gender"],
        "patient_birthdate": study["stl_patient_birthdate"],
        "patient_recentdate": study["stl_patient_recentdate"],
    }

    return {"code": 200, "message": "OK", "context": info}

async def update_study_patient(
    conn: aiomysql.Connection,
    stl_seq: int,
    patient_id: str,
    patient_name: str,
    patient_gender: str,
    patient_birthdate: Optional[str],
) -> Dict[str, Any]:
    update_sql = """
        UPDATE curaxel_skin.study_list
        SET
            stl_patient_id = %s,
            stl_patient_name = %s,
            stl_patient_gender = %s,
            stl_patient_birthdate = %s
        WHERE stl_seq = %s
    """
    params = (
        patient_id,
        patient_name,
        patient_gender,
        patient_birthdate,
        stl_seq,
    )

    async with conn.cursor(aiomysql.cursors.DictCursor) as cur:
        await cur.execute(update_sql, params)
        await conn.commit()

    return {"code": 200, "message": "OK"}

async def get_series_note(
    conn: aiomysql.Connection,
    stl_seq: int,
    srl_seq: int
) -> Dict[str, Any]:
    async with conn.cursor(aiomysql.cursors.DictCursor) as cur:
        await cur.execute(
            """
            SELECT srl_patient_note
            FROM curaxel_skin.series_list
            WHERE stl_seq = %s AND srl_seq = %s
            """,
            (stl_seq, srl_seq)
        )
        row = await cur.fetchone()
        if not row:
            return {"code": 404, "message": "Series not found", "context": None}
        return {"code": 200, "message": "OK", "context": row["srl_patient_note"]}

async def update_series_note(
    conn: aiomysql.Connection,
    stl_seq: int,
    srl_seq: int,
    note: str
) -> Dict[str, Any]:
    async with conn.cursor() as cur:
        await cur.execute(
            """
            UPDATE curaxel_skin.series_list
            SET srl_patient_note = %s
            WHERE stl_seq = %s AND srl_seq = %s
            """,
            (note, stl_seq, srl_seq)
        )
        await conn.commit()
        return {"code": 200, "message": "Note updated"}