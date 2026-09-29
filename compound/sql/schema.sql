-- Compound — MySQL schema (MySQL 5.7+ / MariaDB 10.2+)
-- Run this once in phpMyAdmin (Hostinger) against your database.
SET NAMES utf8mb4;
SET foreign_key_checks = 0;

-- ---------- Users & auth ----------
CREATE TABLE IF NOT EXISTS users (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  email         VARCHAR(190) NOT NULL,
  display_name  VARCHAR(120) DEFAULT NULL,
  is_admin      TINYINT(1) NOT NULL DEFAULT 0,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at  DATETIME DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- One-time login codes (passwordless)
CREATE TABLE IF NOT EXISTS login_codes (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  email       VARCHAR(190) NOT NULL,
  code_hash   CHAR(64) NOT NULL,          -- sha256(code)
  expires_at  DATETIME NOT NULL,
  consumed_at DATETIME DEFAULT NULL,
  attempts    INT NOT NULL DEFAULT 0,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_codes_email (email, expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Bearer sessions
CREATE TABLE IF NOT EXISTS sessions (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id      BIGINT UNSIGNED NOT NULL,
  token_hash   CHAR(64) NOT NULL,          -- sha256(token)
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at   DATETIME NOT NULL,
  last_used_at DATETIME DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_sessions_token (token_hash),
  KEY idx_sessions_user (user_id),
  CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------- Onboarding profile ----------
CREATE TABLE IF NOT EXISTS onboarding (
  user_id       BIGINT UNSIGNED NOT NULL,
  goal          VARCHAR(60) DEFAULT NULL,
  focus_areas   TEXT DEFAULT NULL,         -- JSON array of strings
  target        VARCHAR(20) DEFAULT NULL,  -- 2w / 30d / 90d
  role          VARCHAR(60) DEFAULT NULL,
  level         VARCHAR(30) DEFAULT NULL,
  daily_minutes INT DEFAULT 10,
  format        VARCHAR(20) DEFAULT 'both',
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id),
  CONSTRAINT fk_onboarding_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------- Content: books ----------
CREATE TABLE IF NOT EXISTS books (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  slug        VARCHAR(120) NOT NULL,
  title       VARCHAR(200) NOT NULL,
  author      VARCHAR(160) NOT NULL,
  category    VARCHAR(60) NOT NULL DEFAULT 'Communication',
  cover_class VARCHAR(20) NOT NULL DEFAULT 'cov1',
  blurb       TEXT DEFAULT NULL,
  summary     TEXT DEFAULT NULL,         -- full written summary; paragraphs separated by a blank line
  minutes     INT NOT NULL DEFAULT 9,
  sort        INT NOT NULL DEFAULT 0,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_books_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS book_insights (
  id       BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  book_id  BIGINT UNSIGNED NOT NULL,
  idx      INT NOT NULL DEFAULT 0,
  text     VARCHAR(400) NOT NULL,
  PRIMARY KEY (id),
  KEY idx_bi_book (book_id, idx),
  CONSTRAINT fk_bi_book FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------- Content: paths & lessons ----------
CREATE TABLE IF NOT EXISTS paths (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  slug        VARCHAR(120) NOT NULL,
  title       VARCHAR(200) NOT NULL,
  subtitle    VARCHAR(255) DEFAULT NULL,
  goal        VARCHAR(60) NOT NULL DEFAULT 'Communication',
  description TEXT DEFAULT NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_paths_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS lessons (
  id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  path_id        BIGINT UNSIGNED NOT NULL,
  idx            INT NOT NULL DEFAULT 0,
  title          VARCHAR(200) NOT NULL,
  source_book_id BIGINT UNSIGNED DEFAULT NULL,
  est_minutes    INT NOT NULL DEFAULT 10,
  mission_line   VARCHAR(255) DEFAULT NULL,
  PRIMARY KEY (id),
  KEY idx_lessons_path (path_id, idx),
  CONSTRAINT fk_lessons_path FOREIGN KEY (path_id) REFERENCES paths(id) ON DELETE CASCADE,
  CONSTRAINT fk_lessons_book FOREIGN KEY (source_book_id) REFERENCES books(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Swipeable insight cards
CREATE TABLE IF NOT EXISTS cards (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  lesson_id     BIGINT UNSIGNED NOT NULL,
  idx           INT NOT NULL DEFAULT 0,
  heading       VARCHAR(255) NOT NULL,
  body          TEXT DEFAULT NULL,
  quote         TEXT DEFAULT NULL,
  callout_title VARCHAR(120) DEFAULT NULL,
  callout_body  TEXT DEFAULT NULL,
  source_label  VARCHAR(160) DEFAULT NULL,
  PRIMARY KEY (id),
  KEY idx_cards_lesson (lesson_id, idx),
  CONSTRAINT fk_cards_lesson FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------- Quiz ----------
CREATE TABLE IF NOT EXISTS quiz_questions (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  lesson_id   BIGINT UNSIGNED NOT NULL,
  idx         INT NOT NULL DEFAULT 0,
  question    VARCHAR(400) NOT NULL,
  explanation VARCHAR(600) DEFAULT NULL,
  PRIMARY KEY (id),
  KEY idx_qq_lesson (lesson_id, idx),
  CONSTRAINT fk_qq_lesson FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS quiz_options (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  question_id BIGINT UNSIGNED NOT NULL,
  idx         INT NOT NULL DEFAULT 0,
  label       VARCHAR(300) NOT NULL,
  is_correct  TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_qo_q (question_id, idx),
  CONSTRAINT fk_qo_q FOREIGN KEY (question_id) REFERENCES quiz_questions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------- Assignment template (per lesson) ----------
CREATE TABLE IF NOT EXISTS assignments (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  lesson_id    BIGINT UNSIGNED NOT NULL,
  title        VARCHAR(200) NOT NULL DEFAULT 'Field assignment',
  instructions VARCHAR(600) NOT NULL,
  examples     VARCHAR(600) DEFAULT NULL,
  due_days     INT NOT NULL DEFAULT 2,
  PRIMARY KEY (id),
  UNIQUE KEY uq_assign_lesson (lesson_id),
  CONSTRAINT fk_assign_lesson FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------- Per-user progress ----------
CREATE TABLE IF NOT EXISTS user_lesson (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id      BIGINT UNSIGNED NOT NULL,
  lesson_id    BIGINT UNSIGNED NOT NULL,
  status       VARCHAR(20) NOT NULL DEFAULT 'in_progress', -- in_progress / done
  completed_at DATETIME DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_ul (user_id, lesson_id),
  CONSTRAINT fk_ul_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_ul_lesson FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS user_quiz (
  id        BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id   BIGINT UNSIGNED NOT NULL,
  lesson_id BIGINT UNSIGNED NOT NULL,
  score     INT NOT NULL DEFAULT 0,
  total     INT NOT NULL DEFAULT 0,
  taken_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_uq (user_id, lesson_id),
  CONSTRAINT fk_uq_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS user_assignment (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id      BIGINT UNSIGNED NOT NULL,
  lesson_id    BIGINT UNSIGNED NOT NULL,
  status       VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending / submitted / reviewed
  reflection   TEXT DEFAULT NULL,
  due_at       DATETIME DEFAULT NULL,
  submitted_at DATETIME DEFAULT NULL,
  reviewed_at  DATETIME DEFAULT NULL,
  feedback     TEXT DEFAULT NULL,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_ua (user_id, lesson_id),
  CONSTRAINT fk_ua_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_ua_lesson FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS assignment_files (
  id                 BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_assignment_id BIGINT UNSIGNED NOT NULL,
  kind               VARCHAR(10) NOT NULL, -- photo / audio
  path               VARCHAR(255) NOT NULL,
  original_name      VARCHAR(200) DEFAULT NULL,
  size               INT DEFAULT 0,
  created_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_af (user_assignment_id),
  CONSTRAINT fk_af_ua FOREIGN KEY (user_assignment_id) REFERENCES user_assignment(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS playbook (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id     BIGINT UNSIGNED NOT NULL,
  title       VARCHAR(300) NOT NULL,
  source      VARCHAR(200) DEFAULT NULL,
  tried_count INT NOT NULL DEFAULT 1,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_pb_user (user_id),
  CONSTRAINT fk_pb_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS coach_messages (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id    BIGINT UNSIGNED NOT NULL,
  role       VARCHAR(12) NOT NULL, -- user / assistant
  content    MEDIUMTEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_cm_user (user_id, id),
  CONSTRAINT fk_cm_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS user_stats (
  user_id          BIGINT UNSIGNED NOT NULL,
  streak           INT NOT NULL DEFAULT 0,
  last_active_date DATE DEFAULT NULL,
  growth_score     INT NOT NULL DEFAULT 0,
  insights_learned INT NOT NULL DEFAULT 0,
  actions_done     INT NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id),
  CONSTRAINT fk_stats_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET foreign_key_checks = 1;
