-- Enforce duplicate prevention at the database level for PostgreSQL.
-- Run this in psql or your PostgreSQL GUI (DBeaver/TablePlus/Supabase SQL editor).

CREATE UNIQUE INDEX IF NOT EXISTS uq_personal_name_age_gender
ON personal_files (name, age, gender);

CREATE UNIQUE INDEX IF NOT EXISTS uq_family_head_membercount
ON family_files (head_name, member_count);

CREATE UNIQUE INDEX IF NOT EXISTS uq_referral_name
ON referral_files (referral_name);

CREATE UNIQUE INDEX IF NOT EXISTS uq_emergency_name_age_gender
ON emergency_files (name, age, gender);
