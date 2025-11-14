CREATE TABLE `member` (
  `m_seq` int NOT NULL AUTO_INCREMENT COMMENT 'member sequence number',
  `mr_seq` int NOT NULL COMMENT 'FK: member_role sequence number',
  `name` varchar(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '이름',
  `email` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '이메일',
  `password` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '패스워드',
  `salt` varchar(35) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'salt',
  `allow` varchar(2) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'N',
  `description` varchar(1000) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '',
  `reg_date` datetime DEFAULT NULL COMMENT '등록일',
  `upd_date` datetime DEFAULT NULL COMMENT '수정일',
  `del_yn` char(1) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'N',
  `last_login_date` datetime DEFAULT NULL,
  `password_expiry_date` datetime DEFAULT NULL,
  `must_change_password` TINYINT(1) NULL DEFAULT NULL COMMENT '비밀번호 변경 필요 여부 (1: 변경 필요, 0: 변경 완료)',
  PRIMARY KEY (`m_seq`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `study_list` (
	`stl_seq` int NOT NULL AUTO_INCREMENT COMMENT 'study id',
    `stl_patient_id` varchar(100) NOT NULL COMMENT 'patient id',
    `stl_patient_name` varchar(100) NOT NULL COMMENT 'patient name',
    `stl_patient_gender` char(1) NOT NULL COMMENT 'patient gender M/F',
    `stl_patient_birthdate` date COMMENT 'patient birth',
    `stl_patient_studydate` datetime COMMENT 'patient studydate',
    `stl_patient_recentdate` datetime COMMENT 'patient studydate',
    `stl_patient_status` varchar(20) COMMENT 'patient status',
    `stl_patient_tag` varchar(20) COMMENT 'patient status',
     PRIMARY KEY (`stl_seq`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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

CREATE TABLE `platform_env` (
	`env_seq` int NOT NULL AUTO_INCREMENT COMMENT 'env id',
    `env_type` int NOT NULL COMMENT 'env type',
    `env_watch_uri` varchar(300) COMMENT 'env_watch_uri',
    `env_extra` varchar(300) COMMENT 'env extra',
     PRIMARY KEY (`env_seq`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `notice_alarm` (
	`na_seq` int NOT NULL AUTO_INCREMENT COMMENT 'env id',
    `na_type` int NOT NULL COMMENT 'env type',
    `na_date` datetime COMMENT 'alarm date',
    `na_context` varchar(300) COMMENT 'alarm context',
    `na_target` varchar(300) COMMENT 'alarm target',
    `na_period_start` datetime COMMENT 'alarm start date',
    `na_period_end` datetime COMMENT 'alarm end date',
    `na_live` char(1) COMMENT 'alarm live Y/N',
     PRIMARY KEY (`na_seq`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

