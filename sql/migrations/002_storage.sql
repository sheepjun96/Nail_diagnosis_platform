ALTER TABLE upload_file MODIFY uf_memo_3 TEXT NOT NULL;
ALTER TABLE upload_file MODIFY uf_memo_4 LONGTEXT NOT NULL;
ALTER TABLE series_list MODIFY srl_patient_note VARCHAR(1000) NULL;

INSERT IGNORE INTO project_list
    (project_seq, pl_write_seq, pl_write_date, pl_project_title, pl_project_type)
VALUES (1, 0, NOW(), 'Default project', '0');
