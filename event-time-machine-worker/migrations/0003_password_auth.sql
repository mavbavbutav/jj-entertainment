ALTER TABLE customers ADD COLUMN password_hash TEXT;
ALTER TABLE customers ADD COLUMN password_salt TEXT;
ALTER TABLE customers ADD COLUMN password_algorithm TEXT;
ALTER TABLE customers ADD COLUMN password_iterations INTEGER;
ALTER TABLE customers ADD COLUMN password_updated_at TEXT;
