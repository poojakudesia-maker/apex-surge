-- Adds the written book summary shown on each book page.
-- Run ONCE on a database created before this change, then re-import seed.sql to load the summaries.
-- (If you get "Duplicate column name 'summary'", the column already exists; just re-import seed.sql.)
ALTER TABLE books ADD COLUMN summary TEXT DEFAULT NULL AFTER blurb;
