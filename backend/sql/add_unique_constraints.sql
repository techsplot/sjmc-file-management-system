-- Enforce duplicate prevention at the database level for SJMC records.
-- Run this in phpMyAdmin (SQL tab) after selecting the sjmc database.

USE sjmc;

-- Personal files: same person profile should not be inserted twice.
ALTER TABLE personal_files
ADD UNIQUE KEY uq_personal_name_age_gender (name, age, gender);

-- Family files: same head name + member count combination should be unique.
ALTER TABLE family_files
ADD UNIQUE KEY uq_family_head_membercount (headName, memberCount);

-- Referral files: referral name should be unique.
ALTER TABLE referral_files
ADD UNIQUE KEY uq_referral_name (referralName);

-- Emergency files: same person profile should not be inserted twice.
ALTER TABLE emergency_files
ADD UNIQUE KEY uq_emergency_name_age_gender (name, age, gender);
