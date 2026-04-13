USE curaxel_skin;


CREATE TABLE `project_list` (
	`project_seq` int NOT NULL AUTO_INCREMENT COMMENT 'study id',
	`pl_write_seq` int NOT NULL COMMENT 'member number',
    `pl_write_date` datetime NOT NULL COMMENT 'write date',
    `pl_project_title` varchar(100) NOT NULL COMMENT 'project name',
    `pl_project_type` char(1) NOT NULL COMMENT '0 close, 1 open, 2 limit',
    `pl_project_group` date COMMENT 'project allow project',
     PRIMARY KEY (`project_seq`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

select * from project_list;

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

select * from study_list;

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

select * from series_list;
/* delete from series_list where srl_seq=13; */

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
    `uf_memo_3` varchar(100) NOT NULL COMMENT 'crops summary',
    `uf_memo_4` varchar(100) NOT NULL COMMENT 'ai summary',
	`uf_del_yn` char(1) DEFAULT 'N',
     PRIMARY KEY (`uf_seq`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

select * from upload_file;
