import aiomysql
from typing import List, Dict, Any, Optional, Tuple

async def get_member_list(
    conn: aiomysql.Connection,
    mr_seq: Optional[str] = None,
    search: Optional[str] = None,
    filter_key: str = "name_asc",
    page: int = 1,
    rows: int = 20,
) -> List[Dict]:
    order_map = {
        "name_asc": "m_name ASC",
        "name_desc": "m_name DESC",
        "email_asc": "m_email ASC",
        "email_desc": "m_email DESC",
        "upd_asc": "m_upd_date ASC",
        "upd_desc": "m_upd_date DESC",
    }
    order_by = order_map.get(filter_key, "m_name ASC")  # 기본값: 이름 오름차순

    # 2) page, rows 안전 처리
    if page < 1:
        page = 1
    if rows < 1:
        rows = 20
    offset = (page - 1) * rows

    where_clauses = ["(m_del_yn = 'N')"]
    params: List[Any] = []

    if mr_seq:
        try:
            seq_list: List[int] = [
                int(x.strip()) for x in mr_seq.split(",") if x.strip()
            ]
        except ValueError:
            # 숫자로 변환 안 되는 값이 들어온 경우
            return {
                "code": 400,
                "state": "error",
                "msg": "m_seq 파라미터는 숫자만 콤마(,)로 구분해서 입력해주세요.",
            }
    else:
        seq_list = []

    if seq_list :
        placeholders = ",".join(["%s"] * len(seq_list))
        where_clauses.append(f"m_seq IN ({placeholders})")
        params.extend(seq_list)

    if search:
        where_clauses.append("(m_name LIKE %s OR m_email LIKE %s)")
        like = f"%{search}%"
        params.extend([like, like])

    where_sql = " AND ".join(where_clauses)

    count_sql = f"""
        SELECT COUNT(*) AS total
        FROM member
        WHERE {where_sql}
    """

    async with conn.cursor(aiomysql.DictCursor) as cur:
        await cur.execute(count_sql, params)
        count_row = await cur.fetchone()
        total = count_row["total"] if count_row else 0

    list_sql = f"""
        SELECT 
            m_seq,
            mr_seq,
            m_name,
            m_email,
            m_allow,
            m_description,
            m_reg_date,
            m_upd_date,
            m_del_yn,
            m_last_login_date,
            m_password_expiry_date,
            m_must_change_password
        FROM member
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