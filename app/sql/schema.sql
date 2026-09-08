-- Apex Surge — MySQL schema (paste this into phpMyAdmin's SQL tab, once, on your Hostinger database)

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  display_name VARCHAR(255) NOT NULL DEFAULT '',
  onboarding_why TEXT NULL,
  onboarding_areas TEXT NULL,        -- JSON array, stored as text
  onboarding_challenge TEXT NULL,
  onboarding_time INT NULL,
  onboarding_style VARCHAR(32) NULL,
  onboarding_complete TINYINT(1) NOT NULL DEFAULT 0,
  journey_title VARCHAR(255) NULL,
  growth_score INT NOT NULL DEFAULT 50,
  streak INT NOT NULL DEFAULT 0,
  last_active_date DATE NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS missions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  mission_date DATE NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  book_title VARCHAR(255) NULL,
  book_author VARCHAR(255) NULL,
  lesson_title VARCHAR(255) NULL,
  lesson_body TEXT NULL,             -- JSON array of paragraphs
  quiz_question TEXT NULL,
  quiz_options TEXT NULL,            -- JSON array
  quiz_correct_index INT NULL,
  quiz_explain TEXT NULL,
  quiz_answer INT NULL,
  reflection TEXT NULL,
  pattern TEXT NULL,                 -- JSON object
  experiment TEXT NULL,              -- JSON object
  duration_min INT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_user_date (user_id, mission_date),
  CONSTRAINT fk_missions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS journeys (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  goal_title VARCHAR(255) NOT NULL,
  goal_description TEXT NULL,
  weeks TEXT NOT NULL,                -- JSON array
  focus_areas TEXT NULL,              -- JSON array
  book_refs TEXT NULL,                -- JSON array
  assessment TEXT NULL,               -- JSON array
  current_week INT NOT NULL DEFAULT 1,
  progress_pct INT NOT NULL DEFAULT 0,
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  completed_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_journeys_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS experiments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT NULL,
  area VARCHAR(64) NULL,
  behavior VARCHAR(255) NULL,
  source VARCHAR(255) NULL,
  days TEXT NOT NULL,                 -- JSON array of booleans
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  streak INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_experiments_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS playbook_insights (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  book VARCHAR(255) NULL,
  text TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_insights_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS playbook_principles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  text TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_principles_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS works_for_me (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  text TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_works_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS coach_threads (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_threads_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS coach_messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  thread_id INT NOT NULL,
  role VARCHAR(16) NOT NULL,
  text TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_messages_thread FOREIGN KEY (thread_id) REFERENCES coach_threads(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS roleplays (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  scenario VARCHAR(64) NOT NULL,
  transcript TEXT NOT NULL,           -- JSON array of {role, text}
  feedback TEXT NULL,                 -- JSON object
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_roleplays_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS weekly_reviews (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  learned_tags TEXT NULL,             -- JSON array
  applied TEXT NULL,
  failed_reason TEXT NULL,
  pattern TEXT NULL,
  next_week_plan TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_reviews_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS books (
  id VARCHAR(64) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  author VARCHAR(255) NOT NULL,
  tag VARCHAR(64) NULL,
  color VARCHAR(16) NULL,
  key_idea TEXT NULL,
  example TEXT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO books (id, title, author, tag, color, key_idea, example) VALUES
('atomic-habits', 'Atomic Habits', 'James Clear', 'Habits', '#7c5cff',
 'Make the first step of a habit so small it''s almost impossible to say no to.',
 'Instead of ''work on the presentation for 2 hours,'' the rule becomes ''open the file and write one slide title.'' Motivation follows the start, not the other way around.'),
('deep-work', 'Deep Work', 'Cal Newport', 'Focus', '#2ee6a6',
 'Schedule blocks of undistracted, cognitively demanding work as deliberately as meetings.',
 'Block 90 minutes before 11am, phone in another room, one task only.'),
('essentialism', 'Essentialism', 'Greg McKeown', 'Priorities', '#ff8a5c',
 'If it isn''t a clear yes, it''s a clear no. Do less, but better.',
 'Audit your current commitments and cut the ones that aren''t a ''hell yes.'''),
('radical-candor', 'Radical Candor', 'Kim Scott', 'Leadership', '#ffcf5c',
 'Care personally and challenge directly, at the same time.',
 'Give feedback that names the specific behavior and why it matters to the person, not just the business.'),
('never-split-the-difference', 'Never Split the Difference', 'Chris Voss', 'Negotiation', '#ff5c7a',
 'Ask calibrated ''how'' and ''what'' questions instead of making direct asks.',
 'Replace ''I need a raise'' with ''How would you feel about revisiting my level this quarter?'''),
('mindset', 'Mindset', 'Carol Dweck', 'Growth', '#5cc8ff',
 'Ability grows with effort; treat setbacks as data, not verdicts.',
 'Replace ''I''m bad at this'' with ''I''m not good at this yet.'''),
('confidence-code', 'The Confidence Code', 'Katty Kay & Claire Shipman', 'Confidence', '#c084fc',
 'Confidence is built through action, not thought — it follows doing, not the reverse.',
 'Take the small uncomfortable action before you feel ready, not after.'),
('eat-that-frog', 'Eat That Frog', 'Brian Tracy', 'Productivity', '#34d399',
 'Do your hardest, most important task first thing, before anything else.',
 'Identify tomorrow''s ''frog'' tonight, and do nothing else until it''s done.')
ON DUPLICATE KEY UPDATE title=VALUES(title);
