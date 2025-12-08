CREATE TABLE `member` (
  `m_seq` int NOT NULL AUTO_INCREMENT COMMENT 'member sequence number',
  `mr_seq` int NOT NULL COMMENT 'FK: member_role sequence number',
  `m_name` varchar(10) NOT NULL COMMENT '이름',
  `m_email` varchar(100) NOT NULL COMMENT '이메일',
  `m_password` varchar(200) NOT NULL COMMENT '패스워드',
  `m_salt` varchar(35) NOT NULL COMMENT 'salt',
  `m_allow` varchar(2) NOT NULL DEFAULT 'N',
  `m_description` varchar(1000) DEFAULT '',
  `m_reg_date` datetime DEFAULT NULL COMMENT '등록일',
  `m_upd_date` datetime DEFAULT NULL COMMENT '수정일',
  `m_del_yn` char(1) DEFAULT 'N',
  `m_last_login_date` datetime DEFAULT NULL,
  `m_password_expiry_date` datetime DEFAULT NULL,
  `m_must_change_password` TINYINT(1) NULL DEFAULT NULL COMMENT '비밀번호 변경 필요 여부 (1: 변경 필요, 0: 변경 완료)',
  PRIMARY KEY (`m_seq`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO member 
(mr_seq, m_name, m_email, m_password, m_salt, m_allow, m_description, m_reg_date, m_upd_date, m_del_yn, m_last_login_date, m_password_expiry_date, m_must_change_password)
VALUES
(0, 'admin', 'admin@gachon.ac.kr', 'sha:123456789', 'asd15a63sd', 'Y', 'Admin only', '2025-01-17 10:12:00', '2025-01-17 10:12:00', 'N', '2025-01-17 10:12:00', '2026-01-17 10:12:00', 0);

/*
Role
0 : Root - Just One
1 : System Admin - Any
2 : Project Manager
3 : Reader
4 : Researcher
99 : User
*/
CREATE TABLE `member_role` (
  `mr_index` int NOT NULL AUTO_INCREMENT COMMENT 'member role index',
  `mr_seq` int NOT NULL COMMENT 'FK: member role number',
  `mr_name` varchar(30) NOT NULL COMMENT '권한명',
  `mr_reg_date` datetime DEFAULT NULL COMMENT '등록일',
  `mr_upd_date` datetime DEFAULT NULL COMMENT '수정일',
  `description` varchar(1000) DEFAULT '',
  `del_yn` char(1) DEFAULT 'N',
  PRIMARY KEY (`mr_index`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO member_role 
(mr_seq, mr_name, mr_reg_date, mr_upd_date, description, del_yn)
VALUES
(0, 'Admin', '2025-11-26 09:00:00', '2025-11-26 09:00:00', '관리자 Only', 'N'),
(1, 'Project Admin', '2025-11-26 09:00:00', '2025-11-26 09:00:00', '시스템 관리자', 'N'),
(2, 'Project Manager', '2025-11-26 09:00:00', '2025-11-26 09:00:00', '프로젝트 관리자', 'N'),
(3, 'Reader', '2025-11-26 09:00:00', '2025-11-26 09:00:00', '팀장', 'N'),
(4, 'Researcher', '2025-11-26 09:00:00', '2025-11-26 09:00:00', '연구원', 'N'),
(99, 'User', '2025-11-26 09:00:00', '2025-11-26 09:00:00', '유저', 'N')
;

select * from member_role;

CREATE TABLE `project_list` (
	`project_seq` int NOT NULL AUTO_INCREMENT COMMENT 'study id',
	`pl_write_seq` int NOT NULL COMMENT 'member number',
    `pl_write_date` datetime NOT NULL COMMENT 'write date',
    `pl_project_title` varchar(100) NOT NULL COMMENT 'project name',
    `pl_project_type` char(1) NOT NULL COMMENT '0 close, 1 open, 2 limit',
    `pl_project_group` date COMMENT 'project allow project',
     PRIMARY KEY (`project_seq`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `study_list` (
	`stl_seq` int NOT NULL AUTO_INCREMENT COMMENT 'study id',
	`project_seq` int NOT NULL COMMENT 'FK: project number',
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


CREATE TABLE `upload_file` (
	`uf_seq` int NOT NULL AUTO_INCREMENT COMMENT 'upload file id',
    `uf_upload_write` varchar(50) COMMENT 'upload file write/org(type)',
    `uf_upload_date` datetime COMMENT 'alarm date',
    `uf_uri` varchar(300) COMMENT 'file uri',
    `uf_filetype` int NOT NULL COMMENT 'type origin 0, crop 1, extra 2, ai 3, sariasis 4',
    `uf_memo_1` varchar(100) NOT NULL COMMENT 'if crop, write T, I, M, R, P',
    `uf_memo_2` varchar(100) NOT NULL COMMENT 'extram summary',
    `uf_memo_3` varchar(100) NOT NULL COMMENT 'obbs summary',
    `uf_memo_4` varchar(100) NOT NULL COMMENT 'ai summary',
	`uf_del_yn` char(1) DEFAULT 'N',
     PRIMARY KEY (`uf_seq`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO upload_file 
(uf_upload_write, up_upload_date, uf_uri, uf_filetype, uf_memo_1, uf_memo_2, uf_del_yn)
VALUES
('gcubme', '2025-01-17 10:12:00', 'gcubme_20251117135018.png', 0, 'o', 'origin', 'N'),
('gcubme', '2025-01-02 10:12:00', 'gcubme_20251117135019.png', 0, 'o', 'origin', 'N'),
('gcubme', '2025-01-02 10:12:00', 'gcubme_20251117135020.png', 0, 'o', 'origin', 'N'),
('gcubme', '2025-01-02 10:12:00', 'gcubme_20251117135021.png', 0, 'o', 'origin', 'N'),
('gcubme', '2025-01-02 10:12:00', 'gcubme_20251117135025.png', 0, 'o', 'origin', 'N'),
('gcubme', '2025-01-02 10:12:15', 'crop_i_gcubme_20251117135018.png', 1, 'i', 'gcubme_20251117135018.png', 'N'),
('gcubme', '2025-01-02 10:12:16', 'crop_m_gcubme_20251117135018.png', 1, 'm', 'gcubme_20251117135018.png', 'N'),
('gcubme', '2025-01-02 10:12:17', 'crop_r_gcubme_20251117135018.png', 1, 'r', 'gcubme_20251117135018.png', 'N'),
('gcubme', '2025-01-02 10:12:18', 'crop_p_gcubme_20251117135018.png', 1, 'p', 'gcubme_20251117135018.png', 'N'),
('gcubme', '2025-01-02 10:12:19', 'crop_t_gcubme_20251117135019.png', 1, 't', 'gcubme_20251117135019.png', 'N'),
('gcubme', '2025-01-02 10:12:15', 'crop_i_gcubme_20251117135020.png', 1, 'i', 'gcubme_20251117135020.png', 'N'),
('gcubme', '2025-01-02 10:12:16', 'crop_m_gcubme_20251117135020.png', 1, 'm', 'gcubme_20251117135020.png', 'N'),
('gcubme', '2025-01-02 10:12:17', 'crop_r_gcubme_20251117135020.png', 1, 'r', 'gcubme_20251117135020.png', 'N'),
('gcubme', '2025-01-02 10:12:18', 'crop_p_gcubme_20251117135020.png', 1, 'p', 'gcubme_20251117135020.png', 'N'),
('gcubme', '2025-01-02 10:12:19', 'crop_t_gcubme_20251117135021.png', 1, 't', 'gcubme_20251117135021.png', 'N');

project_list` (
	`project_seq` int NOT NULL AUTO_INCREMENT COMMENT 'study id',
	`pl_write_seq` int NOT NULL COMMENT 'member number',
    `pl_write_date` datetime NOT NULL COMMENT 'write date',
    `pl_project_title` varchar(100) NOT NULL COMMENT 'project name',
    `pl_project_type` char(1) NOT NULL COMMENT '0 close, 1 open, 2 limit',
    `pl_project_group` date COMMENT 'project allow project',
     PRIMARY KEY (`project_seq`);
	
INSERT INTO project_list 
(pl_write_seq, pl_write_date, pl_project_title, uf_filetype, uf_memo_1, uf_memo_2, uf_del_yn)
VALUES
('gcubme', '2025-01-17 10:12:00', 'gcubme_20251117135018.png', 0, 'o', 'origin', 'N'),