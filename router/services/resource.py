import aiomysql
from typing import List, Dict, Any, Optional, Tuple

from test.dumy_data import RESOURCE_STUDY_LIST

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