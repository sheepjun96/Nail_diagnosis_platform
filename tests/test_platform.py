"""Run with: python -m unittest discover -s tests -v (API dependencies installed)."""
import asyncio
from contextlib import asynccontextmanager
import io
import json
import os
import sys
from pathlib import Path
import tempfile
import unittest
from unittest.mock import AsyncMock, MagicMock, patch

from fastapi import Depends, FastAPI, HTTPException, Request, UploadFile
from fastapi.testclient import TestClient
from PIL import Image

from config import Settings
from db import get_conn, transaction
from router.schemas import parse_patient_payload
from services.fingers import finger_names
from services.storage import save_uploaded_image, storage_path
import run_platform


class ConfigurationTests(unittest.TestCase):
    def test_real_checkpoint_matches_configured_class_order(self):
        config = Settings.load()
        if not config.classifier_path.exists():
            self.skipTest("Local model weights are not present in this checkout")
        self.assertEqual(config.validate_models()["classes"],
                         ["Normal", "melanonychia", "nail psoriasis", "onychomycosis"])

    def test_incorrect_class_count_is_rejected(self):
        config = Settings.load()
        if not config.classifier_path.exists():
            self.skipTest("Local model weights are not present")
        config.document["models"]["lesion_classifier"]["class_names"] = ["wrong"]
        with self.assertRaisesRegex(ValueError, "outputs"):
            config.validate_models()

    def test_launcher_secrets_are_generated_once_and_sso_stays_empty(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / ".env"
            initial = run_platform.initialize_env(path, Settings.load())
            repeated = run_platform.initialize_env(path, Settings.load())
            self.assertEqual(initial, repeated)
            for key in run_platform.SECRET_KEYS:
                self.assertEqual(len(initial[key]), 64)
            self.assertFalse(initial["GACHON_SESSION_SECRET"])

    def test_launcher_does_not_replace_existing_credentials(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / ".env"
            path.write_text("DB_PASSWORD=keep-existing\nGACHON_SESSION_SECRET=keep-sso\n", encoding="utf-8")
            values = run_platform.initialize_env(path, Settings.load())
            self.assertEqual(values["DB_PASSWORD"], "keep-existing")
            self.assertEqual(values["GACHON_SESSION_SECRET"], "keep-sso")

    def test_missing_legacy_database_password_stops_startup(self):
        result = MagicMock(stdout="nail_platform_db_data\n")
        with tempfile.TemporaryDirectory() as directory, patch.object(run_platform, "run", return_value=result):
            with self.assertRaisesRegex(RuntimeError, "MySQL"):
                run_platform.guard_existing_database(Path(directory) / ".env", {}, {})

    def test_existing_mysql_80_is_not_upgraded_implicitly(self):
        values = {"DB_PASSWORD": "existing", "MYSQL_IMAGE": "mysql:8.4"}
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / ".env"
            path.touch()
            with patch.object(run_platform, "run", side_effect=[
                MagicMock(stdout="nail_platform_db_data\n"), MagicMock(stdout="mysql:8.0\n"),
            ]):
                with self.assertRaisesRegex(RuntimeError, "8.0"):
                    run_platform.guard_existing_database(path, values, {})

    def test_unknown_existing_volume_is_not_upgraded_by_default(self):
        values = {"DB_PASSWORD": "existing", "MYSQL_IMAGE": "mysql:8.4"}
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / ".env"
            path.touch()
            with patch.object(run_platform, "run", side_effect=[
                MagicMock(stdout="nail_platform_db_data\n"), MagicMock(stdout=""),
            ]):
                with self.assertRaisesRegex(RuntimeError, "NAIL_EXISTING_DB_IMAGE"):
                    run_platform.guard_existing_database(path, values, {})

    def test_check_works_without_starting_docker(self):
        with patch.object(run_platform, "ensure_docker") as docker, patch("sys.stdout", new=io.StringIO()):
            self.assertEqual(run_platform.main(["--check"]), 0)
        docker.assert_not_called()

    def test_disabled_windows_virtualization_is_reported_before_start(self):
        with patch.object(run_platform.shutil, "which", return_value="docker"), \
             patch.object(run_platform, "run") as command, \
             patch.object(run_platform, "docker_available", return_value=False), \
             patch.object(run_platform, "windows_virtualization_enabled", return_value=False):
            with self.assertRaisesRegex(RuntimeError, "가상 머신 플랫폼"):
                run_platform.ensure_docker()
            self.assertEqual(command.call_count, 1)

    def test_first_environment_uses_configured_http_port(self):
        config = Settings.load()
        config.document["server"]["http_port"] = 18888
        with tempfile.TemporaryDirectory() as directory:
            values = run_platform.initialize_env(Path(directory) / ".env", config)
            self.assertEqual(values["NAIL_HTTP_PORT"], "18888")
            self.assertEqual(values["NAIL_PUBLIC_BASE_URL"], "http://localhost:18888")


class StorageTests(unittest.IsolatedAsyncioTestCase):
    async def test_traversal_in_client_filename_never_controls_destination(self):
        image = io.BytesIO()
        Image.new("RGB", (10, 10)).save(image, format="JPEG")
        upload = UploadFile(io.BytesIO(image.getvalue()), filename="../../outside.jpg")
        with tempfile.TemporaryDirectory() as directory:
            path = await save_uploaded_image(upload, directory, "extra")
            self.assertEqual(path.parent, Path(directory))
            self.assertTrue(path.name.startswith("extra_"))
            with Image.open(path) as saved:
                self.assertEqual(saved.format, "PNG")
            self.assertEqual(len(list(Path(directory).iterdir())), 1)

    async def test_fake_image_is_rejected_without_leaving_files(self):
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaises(HTTPException) as error:
                await save_uploaded_image(UploadFile(io.BytesIO(b"not an image"), filename="fake.png"), directory)
            self.assertEqual(error.exception.status_code, 415)
            self.assertEqual(list(Path(directory).iterdir()), [])

    async def test_empty_upload_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaises(HTTPException) as error:
                await save_uploaded_image(UploadFile(io.BytesIO(b""), filename="empty.jpg"), directory)
            self.assertEqual(error.exception.status_code, 400)
            self.assertEqual(list(Path(directory).iterdir()), [])

    async def test_upload_limit_removes_temporary_file(self):
        with tempfile.TemporaryDirectory() as directory, patch.dict(os.environ, {"NAIL_MAX_UPLOAD_MB": "0"}):
            with self.assertRaises(HTTPException) as error:
                await save_uploaded_image(UploadFile(io.BytesIO(b"x"), filename="image.png"), directory)
            self.assertEqual(error.exception.status_code, 413)
            self.assertEqual(list(Path(directory).iterdir()), [])

    def test_legacy_download_rejects_absolute_and_parent_paths(self):
        with tempfile.TemporaryDirectory() as directory:
            for name in ("../secret", "/etc/passwd", "..\\secret", "."):
                with self.subTest(name=name), self.assertRaises(HTTPException):
                    storage_path(directory, name)

    def test_symlink_outside_storage_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            base = Path(directory)
            (base / "inside").mkdir()
            (base / "outside.png").write_bytes(b"private")
            try:
                (base / "inside/link.png").symlink_to(base / "outside.png")
            except OSError:
                self.skipTest("Creating symlinks is not permitted on this Windows host")
            with self.assertRaises(HTTPException):
                storage_path(base / "inside", "link.png")


class TransactionTests(unittest.IsolatedAsyncioTestCase):
    def pool(self):
        conn = AsyncMock()
        @asynccontextmanager
        async def acquire():
            yield conn
        pool = MagicMock()
        pool.acquire = acquire
        return pool, conn

    async def test_success_commits_once(self):
        pool, conn = self.pool()
        async with transaction(pool):
            pass
        conn.begin.assert_awaited_once()
        conn.commit.assert_awaited_once()
        conn.rollback.assert_not_called()

    async def test_partial_failure_rolls_back_all_writes(self):
        pool, conn = self.pool()
        with self.assertRaises(RuntimeError):
            async with transaction(pool):
                raise RuntimeError("series insert failed")
        conn.commit.assert_not_called()
        conn.rollback.assert_awaited_once()

    async def test_commit_failure_cannot_return_success(self):
        pool, conn = self.pool()
        conn.commit.side_effect = RuntimeError("commit failed")
        application = FastAPI()
        application.state.db_pool = pool
        @application.post("/write")
        async def write(request: Request, db=Depends(get_conn, scope="function")):
            return {"ok": True}
        with TestClient(application, raise_server_exceptions=False) as client:
            response = client.post("/write")
        self.assertEqual(response.status_code, 500)
        conn.rollback.assert_awaited_once()


class UploadFlowTests(unittest.IsolatedAsyncioTestCase):
    async def exercise(self, *, ai_error=False, database_error=False):
        import router.api_public as upload_api
        application = FastAPI()
        application.include_router(upload_api.router)
        application.state.redis = MagicMock(eval=AsyncMock(return_value=1))
        conn = AsyncMock()
        @asynccontextmanager
        async def acquire():
            yield conn
        application.state.db_pool = MagicMock(acquire=acquire)
        image = io.BytesIO()
        Image.new("RGB", (10, 10)).save(image, format="PNG")
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            folders = {"base": str(root), "nail": str(root / "img/nail"),
                       "crop": str(root / "img/crop"), "extra": str(root / "img/extra")}
            async def analyze(request, action, payload):
                if ai_error:
                    raise HTTPException(503, "Inference unavailable")
                crop = root / "img/crop/crop.png"
                plot = root / "img/extra/plot.png"
                for path in (crop, plot):
                    path.parent.mkdir(parents=True, exist_ok=True)
                    path.write_bytes(image.getvalue())
                return {"results": [{"cropped_nail_path": str(crop), "plot_path": str(plot),
                    "finger_code": "lt", "crop_info": [0, 0, 10, 10],
                    "ai_result": {"predicted_class": "Normal", "probability": 0.9}}]}
            with patch.dict(os.environ, {"NAIL_UPLOAD_API_KEY": "camera-secret", "NAIL_IMAGE_ROOT": str(root)}), \
                 patch.dict(upload_api.CONFIG_DIR, folders), \
                 patch.object(upload_api, "call_ai", side_effect=analyze), \
                 patch.object(upload_api, "add_file_origin", new=AsyncMock(return_value={"insert_seq": 1})), \
                 patch.object(upload_api, "add_file_crop", new=AsyncMock(side_effect=RuntimeError("DB insert failed") if database_error else None)), \
                 patch.object(upload_api, "add_file_extra", new=AsyncMock()):
                response = TestClient(application, raise_server_exceptions=False).post(
                    "/api/upload", headers={"X-Upload-Token": "camera-secret"},
                    data={"type": "camera"}, files={"file": ("../../unsafe.png", image.getvalue(), "image/png")})
            remaining = list(root.rglob("*.png"))
            return response, remaining, conn

    async def test_camera_upload_persists_original_crop_and_plot(self):
        response, files, conn = await self.exercise()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(files), 3)
        self.assertTrue(response.json()["filename"].startswith("camera_"))
        conn.commit.assert_awaited_once()

    async def test_inference_failure_does_not_leave_original_or_db_record(self):
        response, files, conn = await self.exercise(ai_error=True)
        self.assertEqual(response.status_code, 503)
        self.assertEqual(files, [])
        conn.begin.assert_not_called()

    async def test_database_failure_removes_all_new_images_and_rolls_back(self):
        response, files, conn = await self.exercise(database_error=True)
        self.assertEqual(response.status_code, 500)
        self.assertEqual(files, [])
        conn.rollback.assert_awaited_once()
        conn.commit.assert_not_called()


class ContractTests(unittest.TestCase):
    def test_incomplete_capture_does_not_claim_known_fingers(self):
        names, complete = finger_names(3, "auto")
        self.assertFalse(complete)
        self.assertTrue(all(name.startswith("unknown_") for name in names))

    def test_explicit_single_hand_layout(self):
        names, complete = finger_names(4, "left_fingers")
        self.assertTrue(complete)
        self.assertEqual(names, ["left_pinky", "left_ring", "left_middle", "left_index"])

    def test_invalid_patient_payload_does_not_expose_patient_values(self):
        with self.assertRaises(HTTPException) as error:
            parse_patient_payload(json.dumps({"patientId": "private-id", "patientName": "private-name", "patientBirth": "not-a-date"}))
        self.assertEqual(error.exception.status_code, 422)
        self.assertNotIn("private-name", str(error.exception.detail))

    def test_patient_form_contract_keeps_note_and_dates(self):
        data = parse_patient_payload(json.dumps({"patientId": "id", "patientName": "name", "patientBirth": "", "patientVisit": "2026-11-25T12:30", "patientNote": "note"}))
        self.assertIsNone(data["patientBirth"])
        self.assertEqual(data["patientVisit"], "2026-11-25T12:30:00")

    def test_public_api_has_no_model_imports(self):
        # API-only environment deliberately has no torch/transformers installed.
        import main
        self.assertNotIn("torch", sys.modules)
        self.assertNotIn("transformers", sys.modules)
        self.assertIsInstance(main.app, FastAPI)


class AccessTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        import main
        cls.app = main.app

    def test_liveness_is_anonymous(self):
        # TestClient without a context deliberately skips real infrastructure startup.
        response = TestClient(self.app).get("/health/live")
        self.assertEqual(response.status_code, 200)

    def test_private_images_cannot_be_downloaded_anonymously(self):
        response = TestClient(self.app).get("/images/img/nail/private.png")
        self.assertEqual(response.status_code, 401)

    def test_private_ai_requires_sso(self):
        response = TestClient(self.app).post("/api/predict/", data={"image_path": "img/nail/private.png"})
        self.assertEqual(response.status_code, 401)

    def test_model_metadata_requires_sso(self):
        self.assertEqual(TestClient(self.app).get("/api/config/models").status_code, 401)

    def test_camera_upload_rejects_unknown_token(self):
        with patch.dict(os.environ, {"NAIL_UPLOAD_API_KEY": "expected"}):
            response = TestClient(self.app).post("/api/upload", data={"type": "camera"},
                files={"file": ("image.png", b"unused", "image/png")}, headers={"X-Upload-Token": "wrong"})
        self.assertEqual(response.status_code, 401)

    def test_unconfigured_sso_login_reports_service_unavailable(self):
        with patch.dict(os.environ, {"GACHON_AUTH_DB_USER": "", "GACHON_AUTH_DB_PASSWORD": "", "GACHON_SESSION_SECRET": ""}):
            response = TestClient(self.app).get("/api/auth/login", follow_redirects=False)
        self.assertEqual(response.status_code, 503)

    def test_old_json_emr_route_is_explicitly_retired(self):
        self.assertEqual(TestClient(self.app).post("/send_patient_data", json={}).status_code, 410)

    def test_cross_origin_cookie_write_is_denied(self):
        response = TestClient(self.app).post("/api/auth/logout", headers={"Origin": "https://untrusted.example"})
        self.assertEqual(response.status_code, 403)


if __name__ == "__main__":
    unittest.main()
