-- AI book plans, shared AI lessons and personal SMART goals.
-- Run ONCE on a database created before this change (after 001_book_summaries.sql).
-- If a line fails with "Duplicate column name", that part already exists; run the remaining lines.
ALTER TABLE books ADD COLUMN source VARCHAR(20) NOT NULL DEFAULT 'curated' AFTER sort;
ALTER TABLE books ADD COLUMN needs_review TINYINT(1) NOT NULL DEFAULT 0 AFTER source;
ALTER TABLE books ADD COLUMN is_hidden TINYINT(1) NOT NULL DEFAULT 0 AFTER needs_review;
ALTER TABLE books ADD COLUMN gen_status VARCHAR(20) NOT NULL DEFAULT 'ready' AFTER is_hidden;
ALTER TABLE paths ADD COLUMN user_id BIGINT UNSIGNED DEFAULT NULL AFTER description, ADD KEY idx_paths_user (user_id);
ALTER TABLE assignments ADD COLUMN smart_goal TEXT DEFAULT NULL AFTER due_days;
ALTER TABLE onboarding ADD COLUMN plan_status VARCHAR(20) NOT NULL DEFAULT 'none' AFTER format;

CREATE TABLE IF NOT EXISTS user_books (
  user_id    BIGINT UNSIGNED NOT NULL,
  book_id    BIGINT UNSIGNED NOT NULL,
  rank_no    INT NOT NULL DEFAULT 0,
  reason     VARCHAR(400) DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, book_id),
  KEY idx_ub_rank (user_id, rank_no),
  CONSTRAINT fk_ub_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_ub_book FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS book_lessons (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  book_id      BIGINT UNSIGNED NOT NULL,
  title        VARCHAR(200) NOT NULL,
  mission_line VARCHAR(255) DEFAULT NULL,
  est_minutes  INT NOT NULL DEFAULT 10,
  content      MEDIUMTEXT NOT NULL,
  needs_review TINYINT(1) NOT NULL DEFAULT 1,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_bl_book (book_id),
  CONSTRAINT fk_bl_book FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
