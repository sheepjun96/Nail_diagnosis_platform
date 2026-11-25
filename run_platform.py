"""Start/inspect/stop the complete platform using only the Python standard library.

    python run_platform.py
    python run_platform.py --check
    python run_platform.py --dev
    python run_platform.py --status
    python run_platform.py --logs app
    python run_platform.py --stop
"""
import argparse
import json
import os
from pathlib import Path
import re
import secrets
import shutil
import subprocess
import sys
import time

from config import PROJECT_ROOT, Settings

SECRET_KEYS = ("DB_PASSWORD", "MYSQL_ROOT_PASSWORD", "REDIS_PASSWORD", "NAIL_INTERNAL_API_TOKEN", "NAIL_UPLOAD_API_KEY")
SSO_KEYS = ("GACHON_AUTH_DB_USER", "GACHON_AUTH_DB_PASSWORD", "GACHON_SESSION_SECRET")


def read_env(path):
    if not path.exists():
        return {}
    result = {}
    for line in path.read_text(encoding="utf-8-sig").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        if re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", key):
            value = value.strip()
            if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
                value = value[1:-1]
            result[key] = value
    return result


def initialize_env(path, config):
    """Generate only local infrastructure secrets; never invent SSO credentials."""
    created = not path.exists()
    if created:
        text = (PROJECT_ROOT / ".env-sample").read_text(encoding="utf-8-sig")
        defaults = {
            "NAIL_HTTP_PORT": str(config.value("server", "http_port", 3007)),
            "NAIL_BIND_HOST": config.value("server", "bind_host", "127.0.0.1"),
            "NEXT_PUBLIC_BASE_PATH": config.value("server", "base_path", "/v2"),
            "NAIL_PUBLIC_BASE_URL": f"http://localhost:{config.value('server', 'http_port', 3007)}",
        }
        for key, value in defaults.items():
            text = re.sub(r"^" + key + r"=.*$", key + "=" + value, text, flags=re.MULTILINE)
        path.write_text(text, encoding="utf-8")
    values = read_env(path)
    additions = {}
    text = path.read_text(encoding="utf-8-sig")
    for key in SECRET_KEYS:
        if not values.get(key):
            value = secrets.token_hex(32)
            if re.search(r"^" + key + r"=.*$", text, re.MULTILINE):
                text = re.sub(r"^" + key + r"=.*$", key + "=" + value, text, flags=re.MULTILINE)
            else:
                additions[key] = value
    for key, value in additions.items():
        text += f"\n{key}={value}\n"
    # Initial defaults come from the editable configuration; existing .env choices persist.
    if not values.get("NAIL_HTTP_PORT"):
        text += f"\nNAIL_HTTP_PORT={config.value('server', 'http_port', 3007)}\n"
    path.write_text(text, encoding="utf-8")
    if os.name != "nt":
        path.chmod(0o600)
    return read_env(path)


def run(command, *, env=None, capture=False, timeout=None):
    return subprocess.run(command, cwd=PROJECT_ROOT, env=env, check=True,
                          capture_output=capture, text=True, encoding="utf-8", errors="replace", timeout=timeout)


def docker_available():
    try:
        result = run(["docker", "info", "--format", "{{.ServerVersion}}"], capture=True, timeout=10)
        return bool(result.stdout.strip())
    except (subprocess.SubprocessError, OSError):
        return False


def windows_virtualization_enabled():
    if os.name != "nt":
        return None
    try:
        result = run([
            "powershell", "-NoProfile", "-NonInteractive", "-Command",
            "(Get-CimInstance -ClassName Win32_OptionalFeature -Filter \"Name='VirtualMachinePlatform'\").InstallState",
        ], capture=True, timeout=10)
        state = result.stdout.strip()
        return True if state == "1" else False if state in {"2", "3"} else None
    except (subprocess.SubprocessError, OSError):
        return None


def ensure_docker(timeout=120):
    if not shutil.which("docker"):
        raise RuntimeError("Docker Desktop (or Docker Engine with Compose) must be installed.")
    run(["docker", "compose", "version"], capture=True, timeout=15)
    if docker_available():
        return
    if windows_virtualization_enabled() is False:
        raise RuntimeError("Windows의 '가상 머신 플랫폼' 기능이 비활성화되어 Docker Linux 엔진을 실행할 수 없습니다. WSL 2/가상 머신 플랫폼 설정과 재부팅 후 다시 실행하세요. README의 Windows 안내를 참고하세요.")
    print("Docker 엔진을 시작하는 중입니다…", flush=True)
    try:
        run(["docker", "desktop", "start", "--detach", "--timeout", "30"], capture=True, timeout=40)
    except (subprocess.SubprocessError, OSError):
        pass
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if docker_available():
            return
        time.sleep(3)
    raise RuntimeError("Docker Linux 엔진에 연결할 수 없습니다. Windows의 '가상 머신 플랫폼', WSL 2 및 BIOS 가상화 설정을 확인하세요. 기능 변경 후 재부팅이 필요할 수 있습니다. README의 Windows 안내를 참고하세요.")


def compose_command(env_file, dev=False):
    command = ["docker", "compose", "--project-directory", str(PROJECT_ROOT), "--env-file", str(env_file),
               "-f", str(PROJECT_ROOT / "docker-compose.yml")]
    if dev:
        command += ["-f", str(PROJECT_ROOT / "docker-compose.dev.yml")]
    return command


def guard_existing_database(env_file, values, env):
    project = env.get("COMPOSE_PROJECT_NAME", values.get("COMPOSE_PROJECT_NAME", "nail_platform"))
    try:
        result = run(["docker", "volume", "ls", "--filter", f"label=com.docker.compose.project={project}",
                      "--filter", "label=com.docker.compose.volume=db_data", "--format", "{{.Name}}"], capture=True, timeout=15)
    except subprocess.SubprocessError as exc:
        raise RuntimeError("Existing database volumes could not be checked; startup was stopped safely.") from exc
    if not result.stdout.strip():
        return False
    if not env_file.exists() or not values.get("DB_PASSWORD"):
        raise RuntimeError("기존 MySQL 볼륨이 있습니다. 기존 DB 비밀번호와 MYSQL_IMAGE를 .env에 먼저 설정하세요. 기존 데이터와 볼륨은 변경하지 않았습니다.")
    containers = run(["docker", "ps", "-a", "--filter", f"label=com.docker.compose.project={project}",
                      "--filter", "label=com.docker.compose.service=db", "--format", "{{.Image}}"], capture=True, timeout=15)
    old_80 = any("mysql:8.0" in line for line in containers.stdout.splitlines())
    selected = env.get("MYSQL_IMAGE", values.get("MYSQL_IMAGE", "mysql:8.4"))
    if old_80 and not selected.startswith("mysql:8.0"):
        raise RuntimeError("기존 MySQL 8.0이 감지되었습니다. 자동 업그레이드는 중단했습니다. 백업·호환성 확인 전에는 .env에서 MYSQL_IMAGE=mysql:8.0을 유지하세요.")
    images = {line.strip() for line in containers.stdout.splitlines() if line.strip()}
    recorded = values.get("NAIL_MANAGED_DB_IMAGE") if values.get("NAIL_MANAGED_DB_PROJECT") == project else None
    confirmed = env.get("NAIL_EXISTING_DB_IMAGE", values.get("NAIL_EXISTING_DB_IMAGE"))
    if selected not in images and selected not in {recorded, confirmed}:
        raise RuntimeError("기존 DB 볼륨의 MySQL 이미지 버전을 확인할 수 없습니다. 먼저 실제 버전과 백업을 확인하고 .env의 MYSQL_IMAGE 및 NAIL_EXISTING_DB_IMAGE를 해당 이미지로 명시하세요. 기존 볼륨은 변경하지 않았습니다.")
    return True


def record_database_image(path, project, image):
    """Remember a verified image so normal stop/start does not require containers to remain."""
    text = path.read_text(encoding="utf-8-sig")
    for key, value in {"NAIL_MANAGED_DB_PROJECT": project, "NAIL_MANAGED_DB_IMAGE": image}.items():
        if re.search(r"^" + key + r"=.*$", text, re.MULTILINE):
            text = re.sub(r"^" + key + r"=.*$", key + "=" + value, text, flags=re.MULTILINE)
        else:
            text += f"\n{key}={value}\n"
    path.write_text(text, encoding="utf-8")


def main(argv=None):
    parser = argparse.ArgumentParser(description="Start the Nail Platform Docker services.")
    actions = parser.add_mutually_exclusive_group()
    actions.add_argument("--check", action="store_true", help="Validate model/config files without starting services")
    actions.add_argument("--init", action="store_true", help="Create .env and local secrets without requiring Docker")
    actions.add_argument("--status", action="store_true")
    actions.add_argument("--stop", action="store_true", help="Stop this project and retain all data volumes")
    actions.add_argument("--logs", nargs="?", const="", metavar="SERVICE")
    parser.add_argument("--dev", action="store_true", help="Enable API/frontend hot reload and loopback development ports")
    parser.add_argument("--no-build", action="store_true", help="Reuse existing images")
    parser.add_argument("--env-file", type=Path, default=PROJECT_ROOT / ".env")
    parser.add_argument("--timeout", type=int, default=900, help="Service startup timeout in seconds")
    args = parser.parse_args(argv)
    config = Settings.load()
    env_file = args.env_file.resolve()
    values = read_env(env_file)
    if args.init:
        initialize_env(env_file, config)
        print(f"환경 설정 준비 완료: {env_file}")
        print("기존 가천 SSO의 GACHON_AUTH_DB_USER, GACHON_AUTH_DB_PASSWORD, GACHON_SESSION_SECRET를 입력하세요.")
        return 0
    if args.check:
        # No Docker, model imports, credentials or filesystem mutations required.
        report = config.validate_models()
        print("설정/모델 검사 통과")
        for name in ("detector", "classifier"):
            print(f"  {name}: {report[name]}")
        print("  classes: " + ", ".join(report["classes"]))
        missing = [key for key in SSO_KEYS if not os.environ.get(key, values.get(key))]
        print("  SSO: " + ("설정됨" if not missing else "인증 설정 필요: " + ", ".join(missing)))
        return 0

    if not (args.status or args.stop or args.logs is not None):
        config.validate_models()
    ensure_docker()
    env = {**values, **os.environ}
    command = compose_command(env_file, args.dev)
    if args.status or args.stop or args.logs is not None:
        if not env_file.exists():
            raise RuntimeError(".env 파일이 없습니다. 먼저 python run_platform.py를 실행하세요.")
        if args.status:
            return run(command + ["ps", "--all"], env=env).returncode
        if args.stop:
            return run(command + ["down", "--remove-orphans"], env=env).returncode
        return run(command + ["logs", "--tail", "100", "--follow"] + ([args.logs] if args.logs else []), env=env).returncode

    guard_existing_database(env_file, values, env)
    values = initialize_env(env_file, config)
    env = {**values, **os.environ, "NAIL_HOST_CONFIG": str(config.source)}
    run(command + ["config", "--quiet"], env=env)
    record_database_image(env_file, env.get("COMPOSE_PROJECT_NAME", "nail_platform"), env.get("MYSQL_IMAGE", "mysql:8.4"))
    print("MySQL · Redis · DB 마이그레이션 · AI · API · Frontend · Nginx를 시작합니다.", flush=True)
    options = ["up", "--detach", "--wait", "--wait-timeout", str(args.timeout)]
    if not args.no_build:
        options.append("--build")
    try:
        run(command + options, env=env)
    except subprocess.CalledProcessError:
        run(command + ["ps", "--all"], env=env)
        print("시작 실패: python run_platform.py --logs SERVICE 로 해당 서비스 로그를 확인하세요.", file=sys.stderr)
        return 1
    port = env.get("NAIL_HTTP_PORT", "3007")
    base = env.get("NEXT_PUBLIC_BASE_PATH", "/v2").rstrip("/")
    print(f"\n실행 완료: http://localhost:{port}{base}/app")
    if any(not env.get(key) for key in SSO_KEYS):
        print("서비스는 실행됐지만 가천 SSO 인증 정보가 비어 있습니다. .env의 GACHON_* 항목을 설정한 뒤 다시 실행하세요.")
    print("종료: python run_platform.py --stop (DB·이미지·Redis 볼륨은 보존됩니다.)")
    return 0


if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        print("\n명령을 종료했습니다. 서비스 상태는 --status로 확인하세요.")
        raise SystemExit(130)
    except (RuntimeError, ValueError, FileNotFoundError, subprocess.SubprocessError) as exc:
        print(f"실행 오류: {exc}", file=sys.stderr)
        raise SystemExit(1)
