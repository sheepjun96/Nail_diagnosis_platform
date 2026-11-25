# Curaxel Nail Platform

환자·촬영 회차·손톱 이미지·AI 분류 결과를 관리하는 플랫폼입니다.
웹 API와 AI 추론을 별도 이미지로 분리하고 Docker Compose로 실행합니다. 로그인은 **기존 가천 SSO만** 사용합니다.

## 빠른 시작

필수: Python 3.11 이상, Docker Desktop의 Linux 컨테이너 엔진 또는 Linux Docker Engine, Docker Compose.
호스트에 Node.js, MySQL, Redis, AI Python 패키지를 따로 설치할 필요는 없습니다.
기본 AI 이미지는 CPU용입니다. Docker에 모델을 포함하지 않고 읽기 전용으로 마운트합니다.

```powershell
python run_platform.py --init
python run_platform.py --check
python run_platform.py
```

- `--init`: Git에서 제외되는 `.env`를 준비합니다. DB·Redis·내부 API·촬영 장비용 비밀값을 무작위로 생성합니다.
- `--check`: Docker 실행 없이 모델 경로, 체크포인트 출력 개수, 분류 이름을 검사합니다.
- 기본 실행: 설정 검사 → Docker 확인 → 기존 DB 보호 검사 → 이미지 빌드 → DB 마이그레이션 → 전체 서비스 상태 확인.
- 첫 실행의 이미지 다운로드·빌드는 시간이 걸릴 수 있습니다. 기본 준비 시간 제한은 900초이며 `--timeout`으로 변경합니다.

접속: **http://localhost:3007/v2/app**

기존 가천 서버에서 발급한 다음 값을 `.env`에 입력해야 로그인할 수 있습니다.

```dotenv
GACHON_AUTH_DB_USER=
GACHON_AUTH_DB_PASSWORD=
GACHON_SESSION_SECRET=
```

`GACHON_AUTH_DB_HOST`, `GACHON_REDIS_HOST`, `GACHON_BASE_URL`도 실제 인증 서버와 맞아야 합니다.
SSO 설정이 비어 있으면 서비스 자체는 실행되지만 로그인 화면은 인증 연결 설정이 필요하다고 표시합니다.
SSO 서버에서 Nail의 callback URL로 `NAIL_PUBLIC_BASE_URL/api/auth/sso/callback`을 허용해야 합니다.
다른 PC나 서버에서 접속한다면 `NAIL_PUBLIC_BASE_URL`을 실제 접속 주소로 설정하세요.
외부 접속이 필요할 때만 `NAIL_BIND_HOST=0.0.0.0`으로 변경하고 HTTPS 종료와 방화벽을 구성하세요.

## Windows에서 Docker가 시작되지 않을 때

이번 작업 PC의 Docker Desktop 로그에는 **Virtual Machine Platform not enabled**가 확인되었습니다.
Windows 기능의 **가상 머신 플랫폼**, WSL 2, BIOS/UEFI 가상화 설정을 확인해야 합니다.
필요한 기능 변경 후에는 재부팅이 필요할 수 있습니다. 실행 스크립트가 Windows 기능이나 BIOS를 변경하지는 않습니다.

관리자 PowerShell에서 WSL 설치가 필요한 경우:

```powershell
wsl --install --no-distribution
```

설정 및 재부팅 후 Docker Desktop을 시작하고 Linux 엔진이 정상인지 확인합니다.

```powershell
docker info
python run_platform.py
```

참고: [Docker Desktop Windows 요구 사항](https://docs.docker.com/desktop/setup/install/windows-install/),
[Microsoft WSL 명령](https://learn.microsoft.com/en-us/windows/wsl/basic-commands).

## 서비스와 데이터

| 서비스 | 역할 | 이미지 |
|---|---|---|
| nginx | 외부 진입점과 리버스 프록시 | nail-platform-nginx |
| frontend | Next.js 16 운영 빌드, Node.js 24 | nail-platform-frontend |
| app | FastAPI, 환자·이미지 관리, SSO | nail-platform-api |
| ai | YOLO·MedSigLIP, 추론 직렬화와 결과 캐시 | nail-platform-ai |
| migrate | 버전별 스키마 변경, 완료 후 종료 | nail-platform-api 재사용 |
| storage-init | 이미지 디렉터리 권한 준비, 완료 후 종료 | nail-platform-api 재사용 |
| db | 손톱 데이터, 새 설치는 MySQL 8.4 | mysql |
| redis | 플랫폼 요청 제한·추론 결과 캐시 | redis |

운영 구성은 Nginx의 3007 포트만 호스트에 공개합니다.
DB·Redis·AI 네트워크를 분리하고 프런트엔드에는 DB·SSO 비밀번호를 전달하지 않습니다.
API에는 AI 라이브러리와 모델 파일이 필요하지 않습니다.
추론은 별도 AI 서비스에서 실행하며 API는 추론 동안 DB 연결을 점유하지 않습니다.

- `db_data`: MySQL 데이터
- `curaxel_images`: 원본·crop·추가 이미지
- `redis_data`: 플랫폼 Redis 영속 데이터

**플랫폼 Redis와 기존 SSO Redis는 서로 다른 용도입니다.**
`GACHON_REDIS_HOST`를 신규 `redis` 컨테이너로 바꾸면 기존 SSO 티켓을 찾을 수 없습니다.

현재 구조는 단일 호스트의 Compose 배포이며 API와 AI가 이미지 볼륨을 공유합니다.
다른 호스트로 분산하려면 이미지 저장소를 S3 호환 객체 저장소 등으로 옮기고 저장소 접근 계약을 변경해야 합니다.
추론 호출은 현재 동기 HTTP 방식으로 화면 호환성을 유지합니다. 영속 작업 큐·분산 worker는 아직 추가하지 않았습니다.

## 모델 설정

일반 설정은 `platform_config.json`, 비밀값과 배포 환경 설정은 `.env`에서 관리합니다.
모델 파일명이나 하위 폴더가 바뀌면 다음 두 경로를 수정하고 다시 실행하세요.

```json
{
  "models": {
    "nail_detector": {"path": "ai_models/yolov12.pt"},
    "lesion_classifier": {"path": "ai_models/MedSigLIP"}
  }
}
```

위 예시는 설정 항목 설명용 일부입니다. 실제 파일의 나머지 모델 설정은 유지해야 합니다.
모델은 `ai_models` 안에 보관하세요. 이 폴더는 Git과 Docker 빌드 대상에서 제외됩니다.

추가된 MedSigLIP은 일반 `AutoModelForImageClassification.from_pretrained` 형식이 아닙니다.
`model.safetensors` 안에 전체 backbone과 `ln`, `fc`가 저장된 커스텀 모델입니다.
로더는 학습·테스트 노트북의 **이미지 특징 → LayerNorm → Linear** 구조를 사용합니다.
평가 모드의 Dropout은 결과를 바꾸지 않으므로 추론에 필요한 vision 가중치와 분류기만 읽습니다.
가중치가 없는 상태에서 임의의 분류기를 초기화하거나 원격 모델을 자동 다운로드하지 않습니다.

확인된 출력 순서:

| 인덱스 | 클래스 |
|---|---|
| 0 | Normal |
| 1 | melanonychia |
| 2 | nail psoriasis |
| 3 | onychomycosis |

원본 전처리 설정 파일은 체크포인트에 포함되지 않았습니다.
448×448, SigLIP 기본 bicubic 전처리, mean/std 0.5를 설정에 명시했습니다.
학습 노트북에는 CLAHE가 없으므로 기본적으로 사용하지 않습니다.
원본 processor 설정이나 기준 이미지가 있다면 학습 코드와 추론 결과를 추가 대조할 수 있습니다.

모델 경로는 프로젝트 루트 기준으로 해석합니다. Docker 안에서는 `/app` 기준입니다.
로컬 직접 실행 시 이미지 루트 기본값은 `data/images`, Docker에서는 `/curaxel_images`입니다.
직접 Python으로 실행할 때는 환경변수 `NAIL_DETECTOR_MODEL_PATH`, `NAIL_LESION_MODEL_PATH`, `NAIL_IMAGE_ROOT`로도 변경할 수 있습니다.
Docker 실행에서는 `platform_config.json`의 모델 경로를 수정하세요. 호스트와 컨테이너가 함께 읽을 수 있도록 `ai_models/…` 상대 경로를 사용합니다.
실행기의 `NAIL_CONFIG_FILE` 환경변수로 다른 설정 파일을 지정하면 그 파일을 API와 AI 컨테이너에 마운트합니다.

## 시작·종료·개발

```powershell
python run_platform.py --status
python run_platform.py --logs app
python run_platform.py --logs ai
python run_platform.py --no-build
python run_platform.py --stop
```

`--stop`은 이 Compose 프로젝트의 컨테이너를 종료하고 **모든 데이터 볼륨을 보존**합니다.
데이터를 지우는 `down -v` 또는 자동 초기화 동작은 실행 스크립트에 없습니다.

개발 모드:

```powershell
python run_platform.py --dev
```

API·프런트엔드 변경 감시를 켜고 로컬 인터페이스에 개발 포트를 추가합니다.

| 대상 | 호스트 주소 |
|---|---|
| 웹 진입점 | http://localhost:3007 |
| API 및 개발 문서 | http://127.0.0.1:8001/docs |
| MySQL | 127.0.0.1:3308 |
| 플랫폼 Redis | 127.0.0.1:6380 |

운영 모드에서는 소스 마운트·개발 서버·파일 감시를 사용하지 않습니다.
원래 명령인 `python -m uvicorn main:app ...`은 API 하나만 실행하므로 전체 플랫폼 실행에는 `run_platform.py`를 사용하세요.
개발 모드로 시작한 환경을 종료할 때도 `python run_platform.py --dev --stop`을 사용할 수 있습니다.

## 기존 DB와 마이그레이션

기존 볼륨 키를 유지합니다. 실행기가 기존 MySQL 8.0 컨테이너를 감지하면 8.4 자동 전환을 중단합니다.
기존 DB를 먼저 재사용해야 한다면 실제 비밀번호와 `MYSQL_IMAGE=mysql:8.0`을 `.env`에 명시하세요.
이미 데이터가 들어 있는 MySQL은 환경변수의 비밀번호를 바꿔도 실제 DB 계정 비밀번호가 변경되지 않습니다.

MySQL 버전 변경 전에는 DB와 이미지 볼륨의 백업·복원, 업그레이드 호환성을 검증해야 합니다.
기존 컨테이너가 이미 삭제된 경우에는 볼륨만으로 과거 MySQL 버전을 추정하지 않습니다.
기존 DB의 버전과 접속 정보를 확인하고 `MYSQL_IMAGE`와 `NAIL_EXISTING_DB_IMAGE`에 실제 이미지(예: `mysql:8.0`)를 명시한 뒤 실행하세요.
이 실행기가 만든 DB의 확인된 이미지 정보는 `.env`에 기록되므로 일반적인 종료·재시작에는 추가 설정이 필요하지 않습니다.

`migrate`는 다음을 수행합니다.

- `CREATE TABLE IF NOT EXISTS`로 기존 테이블과 데이터를 유지
- `schema_migrations`에 적용 버전과 체크섬 기록
- AI 메타데이터 저장 컬럼 확대, 메모 길이를 1000자로 통일
- 조회 인덱스 추가, 기본 프로젝트 준비
- 기존 고아 레코드가 없는 관계에만 외래키 추가; 고아 데이터는 삭제하지 않고 로그에 알림

적용된 migration 파일을 수정하지 말고 새 버전을 추가하세요.
의미가 바뀌는 환자 데이터 병합·중복 제거·기관 권한 재배치는 자동 수행하지 않습니다.

## 업로드와 호환성

웹 업로드는 SSO와 등록 권한을 확인합니다.
촬영 장비는 `.env`의 `NAIL_UPLOAD_API_KEY`를 `X-Upload-Token` 헤더로 전달합니다.

`POST /api/upload` multipart 필드:

- `type`: 영문·숫자·밑줄·하이픈으로 된 시설/장비 구분, 최대 50자
- `file`: PNG/JPEG/WebP, 기본 최대 30MB, 최대 4천만 화소
- `capture_type`: `auto`, `thumbs`, `fingers`, `left_thumb`, `right_thumb`, `left_fingers`, `right_fingers`

촬영 종류가 불명확하거나 검출 개수가 맞지 않으면 손가락을 임의로 확정하지 않고 `unknown`과 검수 경고를 반환합니다.
분류 신뢰도는 질환 중증도 점수가 아니므로 화면에서도 신뢰도로 표시합니다.

이미지는 서버가 생성한 고유 파일명으로 재인코딩하고 직접 공개하지 않습니다.
기존 `/api/resource/*`, `/api/upload`, `/api/predict/` 호출 형태는 유지했습니다.
구형 `/images/*` 링크도 인증과 역할을 검사합니다.
기존 `/app/*` 주소는 새 프런트엔드로 이동합니다.

`main.py`에 섞여 있던 JSON 파일 기반 OpenEMR 경로
(`/send_patient_data`, `/viewer/{pid}/{appt_date}`, `/upload-hand-image/...`)는
현재 DB·인증·화면과 맞지 않아 HTTP 410으로 명시적으로 비활성화했습니다.
이 경로를 호출하는 외부 EMR이 있다면 현행 인증 API 계약으로 연동을 별도로 이전해야 합니다.
기존 `patient_data.json` 파일은 삭제하지 않습니다.

SSO의 기존 역할 기준은 유지합니다. 기관·프로젝트별 세부 데이터 접근 정책은 실제 SSO 권한 계약에 맞춘 추가 정의가 필요합니다.

## 검증

```powershell
uv sync --frozen
uv run python -m unittest discover -s tests -v
cd nail_front
npm ci
npm run lint
npm run build
npm audit --omit=dev
```

실제 모델 로딩·CPU 추론은 로컬 모델로 확인했습니다.
Docker Compose의 운영·개발 설정 검증과 API 테스트를 수행했습니다.
Docker Desktop의 가상화 기능 문제 때문에 이 PC에서 전체 컨테이너 기동과 실제 DB migration 실행은 검증하지 못했습니다.
