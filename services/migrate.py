"""Versioned, non-destructive schema updates for fresh and existing databases."""
import asyncio
import hashlib
import logging

import aiomysql

from config import PROJECT_ROOT
from db import DB_CONFIG

logger = logging.getLogger(__name__)


async def indexes_and_relations(cursor):
    indexes = {
        "study_list": [("idx_study_project_patient", "project_seq, stl_patient_id"),
                       ("idx_study_recent", "stl_patient_recentdate")],
        "series_list": [("idx_series_study_date", "stl_seq, srl_patient_seriesdate")],
        "upload_file": [("idx_upload_type_date", "uf_del_yn, uf_filetype, uf_upload_date"),
                        ("idx_upload_uri", "uf_uri"), ("idx_upload_origin", "uf_memo_2")],
    }
    for table, entries in indexes.items():
        for name, columns in entries:
            await cursor.execute("SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name=%s AND index_name=%s", (table, name))
            if not (await cursor.fetchone())[0]:
                await cursor.execute(f"CREATE INDEX {name} ON {table} ({columns})")
    for child, column, parent, key, name in (
        ("study_list", "project_seq", "project_list", "project_seq", "fk_study_project"),
        ("series_list", "stl_seq", "study_list", "stl_seq", "fk_series_study"),
    ):
        await cursor.execute("SELECT COUNT(*) FROM information_schema.table_constraints WHERE constraint_schema=DATABASE() AND table_name=%s AND constraint_name=%s", (child, name))
        if (await cursor.fetchone())[0]:
            continue
        await cursor.execute(f"SELECT COUNT(*) FROM {child} c LEFT JOIN {parent} p ON c.{column}=p.{key} WHERE p.{key} IS NULL")
        if (await cursor.fetchone())[0]:
            logger.warning("Skipped %s: existing orphan records require manual reconciliation; no records were removed.", name)
        else:
            await cursor.execute(f"ALTER TABLE {child} ADD CONSTRAINT {name} FOREIGN KEY ({column}) REFERENCES {parent} ({key}) ON DELETE RESTRICT")


async def migrate():
    pool = await aiomysql.create_pool(**{**DB_CONFIG, "minsize": 1, "maxsize": 1, "autocommit": True})
    try:
        async with pool.acquire() as conn:
            async with conn.cursor() as cursor:
                await cursor.execute("SELECT GET_LOCK('nail_platform_schema', 60)")
                if (await cursor.fetchone())[0] != 1:
                    raise RuntimeError("Could not acquire the schema migration lock.")
                try:
                    await cursor.execute("CREATE TABLE IF NOT EXISTS schema_migrations (version VARCHAR(80) PRIMARY KEY, checksum CHAR(64) NOT NULL, applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP)")
                    for version, path in (
                        ("001_baseline", PROJECT_ROOT / "sql/init_env.sql"),
                        ("002_storage", PROJECT_ROOT / "sql/migrations/002_storage.sql"),
                    ):
                        sql = path.read_text(encoding="utf-8-sig")
                        checksum = hashlib.sha256(sql.encode()).hexdigest()
                        await cursor.execute("SELECT checksum FROM schema_migrations WHERE version=%s", (version,))
                        previous = await cursor.fetchone()
                        if previous:
                            if previous[0] != checksum:
                                raise RuntimeError(f"Applied migration {version} was modified. Add a new migration instead.")
                            continue
                        sql = "\n".join(line for line in sql.splitlines() if not line.lstrip().startswith("--"))
                        for statement in sql.split(";"):
                            if statement.strip():
                                await cursor.execute(statement)
                        await cursor.execute("INSERT INTO schema_migrations (version, checksum) VALUES (%s,%s)", (version, checksum))
                        logger.info("Applied migration %s", version)
                    # Idempotent checks also retry constraints skipped because of legacy orphan data.
                    await indexes_and_relations(cursor)
                finally:
                    await cursor.execute("SELECT RELEASE_LOCK('nail_platform_schema')")
    finally:
        pool.close()
        await pool.wait_closed()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    asyncio.run(migrate())
