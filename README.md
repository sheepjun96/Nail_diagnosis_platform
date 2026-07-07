## Curaxel Skin(Nail, ...) Platform

- 목적 : 환자 피부 관리 플랫폼
- EMR 환자 데이터 + AI 기반 손톱 병변 = Report 생성
- 생성된 Report를 EMR 시스템에 등록 및 플랫폼으로 지속 관리

### 관리

- 환자 진료 기록
- 환자 촬영 이미지
- 기타 임상 이미지
- 병변 기록
- 건선 기록

### DB
- sql/init_env.sql

- Nail 데이터 관리
```
CREATE TABLE `series_list` (
	`srl_seq` int NOT NULL AUTO_INCREMENT COMMENT 'series id',
    `stl_seq` int NOT NULL COMMENT 'study id',
    `srl_patient_seriesdate` datetime COMMENT 'patient series date',
    `srl_patient_note` varchar(500) COMMENT 'patient series date',
    `srl_patient_l_t` text NOT NULL COMMENT 'patient left thumb type json normal, extra, soriasis',
    `srl_patient_l_i` text NOT NULL COMMENT 'patient left index type json normal, extra, soriasis',
    `srl_patient_l_m` text NOT NULL COMMENT 'patient left middle type json normal, extra, soriasis',
    `srl_patient_l_R` text NOT NULL COMMENT 'patient left ring type json normal, extra, soriasis',
    `srl_patient_l_p` text NOT NULL COMMENT 'patient left pinky type json normal, extra, soriasis',
    `srl_patient_r_t` text NOT NULL COMMENT 'patient right thumb type json normal, extra, soriasis',
    `srl_patient_r_i` text NOT NULL COMMENT 'patient right index type json normal, extra, soriasis',
    `srl_patient_r_m` text NOT NULL COMMENT 'patient right middle type json normal, extra, soriasis',
    `srl_patient_r_R` text NOT NULL COMMENT 'patient right ring type json normal, extra, soriasis',
    `srl_patient_r_p` text NOT NULL COMMENT 'patient right pinky type json normal, extra, soriasis',
     PRIMARY KEY (`srl_seq`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```
- Study > Serires 단위로 관리
- Nail 세부 데이터는 동적으로 변경가능하기에 Sql + Nosql 기반 데이터 관리 체계로 응용
- srl_patient_* 데이터는 json 타입으로 통일 (Stringfy, parseJson 등으로 변환 관리 필요)
- Json 타입 정의
```
{
    origin : { # 원본 손톱 Crop 된 이미지, 단일 이미지
        path : "C:/curaxel/img/crop/gcubme_20251114135018.png", # 저장경로
        type : "gcubme",                                        # 병원,시설 등 구분
        create  : "20251114 00:00:00",                          # 생성일
        modify  : "20251115 00:00:00",                          # 수정일
        write : 21,                                             # 등록/수정자
    },
    extra : [ # 기타 임상 사진, 여러 사진 확장 가능하기에 목록으로 처리
        {
            path : "C:/curaxel/img/extra/crop_gcubme_20251114135018.png", # 저장경로
            create  : "20251114 00:00:00",                          # 생성일
            modify  : "20251115 00:00:00",                          # 수정일
            write : 21,                                             # 등록/수정자
        }
    ],
    ai : { # AI 기반 병변 결과
        path : "C:/curaxel/img/extra/ai_gcubme_20251114135018.png", # 저장경로
        create  : "20251114 00:00:00",                          # 생성일
        modify  : "20251115 00:00:00",                          # 수정일
        write : 21,                                             # 등록/수정자
    },
    soriasis : { #건선
        path : "C:/curaxel/img/extra/so_gcubme_20251114135018.png", # 저장경로
        create  : "20251114 00:00:00",                          # 생성일
        modify  : "20251115 00:00:00",                          # 수정일
        write : 21,                                             # 등록/수정자
        metrix : "pitting",         # pitting, leukonychia, red spots in the lunula, nail plate crumbling
        bed : "splinter hemorrhages,onycholysis",       # onycholysis, splinter hemorrhages, oil drop discoloration, nail bed hyperkeratosis
    }
}
```

### Image 데이터 관리

1. curaxel/img/nail :
- 캐논 등 촬영된 원본 이미지 저장
- 파일명 : {연구소/시설 구분타입}_{촬영날짜 datetime}.png/jpg
- 예시 : gcubme_20251114135018.png
- 연구소/시설 구분 타입 : 라즈베리파이를 통해 서버로 들어오는 시설 구분 ex: gcubme 

2. curaxel/img/crop :
- AI 기반 손톱 영역 자른 이미지 저장
- 파일명 : crop_{손가락 index}_{연구소/시설 구분타입}_{촬영날짜 datetime}.png/jpg
- 예시 : crop_p_gcubme_20251114135018.png
- 손가락 Index
-- Thumb : t
-- Index : i
-- Middle : m
-- Ring : r
-- Pinky : p

3. curaxel/img/extra :
- 이외에 수집되는 이미지 저장
- 파일명 : {구분자}_{연구소/시설 구분타입}_{촬영날짜 datetime}.png/jpg
- 구분자
-- extra : 임상의 추가 관리 이미지
--- 파일명 : extra_{연구소/시설 구분타입}_{촬영날짜 datetime}.png/jpg
-- ai : 병변 Segmentation된 이미지
--- 파일명 : ai_{연구소/시설 구분타입}_{촬영날짜 datetime}.png/jpg
-- so : 건선 이미지 (십자표시, 1[왼상단], 2[우상단], 3[우하단], 4[왼하단] 숫자 표기)
--- 파일명 : so_{연구소/시설 구분타입}_{촬영날짜 datetime}.png/jpg


### AI 처리

1. 업로드 과정 중 이미지 분할 처리 (+ 건선 이미지 처리)
a. 캐논과 연결된 라즈베리파이가 서버(외부망 skin.curaxel.com 118.47.175.67, 내부망 10.2.52.122)으로 이미지 업로드
- 캐논과 연결된 라즈베리파이는 30초~1분 간격으로 새롭게 촬영된 이미지 파일을 확인
- 새롭게 촬영된 이미지 파일을 서버로 전송(post, /api/upload) (개발/연구 과정 시 http, 배포/판매 시 https)
- 요청 보낸 내용은 history.txt 파일에 저장

b. 서버에서 업로드 요청 받은 이미지를 손톱 기반 분할 및 건선 처리
- 요청 받은 이미지 및 타입(시설 정보) 확인
- 요청 받은 이미지는 파일명에 맞춰 'CONFIG_DIR["nail"]' 디렉토리에 저장
- 저장된 이미지를 기반으로 손톱 분할 요청
[단, 촬영된 이미지가 엄지/나머지 구분 정보가 없음 <- 이부분 처리 필요]
- 손톱 분할된 이미지는 파일명에 맞춰 'CONFIG_DIR["crop"]' 디렉토리에 저장
- 건선 이미지는 파일명에 맞춰 'CONFIG_DIR["extra"]' 디렉토리에 저장
- DB 수정 필요

2. 환자 등록 페이지(/app/add)에서 환자 정보 등록 시 분할된 이미지를 기반으로 병변 탐지 처리
a. 환자 등록 페이지에서 선택된 분할 손톱 사진을 기반으로 AI 기반 병변 탐지 요청
b. 병변 탐지 데이터는 'series_list' 테이블의 각 손톱 위치에 맞는 column에 json 정의를 기반으로 저장
c. 병변 segmentation 이미지는 파일명에 맞춰 'CONFIG_DIR["extra"]' 디렉토리에 저장