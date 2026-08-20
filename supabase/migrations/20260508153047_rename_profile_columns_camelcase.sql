-- Rename columns to camelCase as per new data structure requirements
ALTER TABLE profiles RENAME COLUMN full_name TO name;
ALTER TABLE profiles RENAME COLUMN previous_role TO "previousRole";
ALTER TABLE profiles RENAME COLUMN open_to_work TO "openToWork";
ALTER TABLE profiles RENAME COLUMN is_sailing TO "isSailing";
ALTER TABLE profiles RENAME COLUMN vessel_name TO "vesselName";

-- Change openToWork to text if it was boolean, to support 'Available'/'Not Available'
ALTER TABLE profiles ALTER COLUMN "openToWork" TYPE text USING (CASE WHEN "openToWork" = true THEN 'Available' ELSE 'Not Available' END);

-- Add missing columns
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS "currentRole" text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS "yearsExperience" integer DEFAULT 0;

-- Drop old columns if they exist and are redundant (e.g. current_position, rank if it existed)
-- Note: 'rank' was not found in the list_tables output, but user mentioned it.
ALTER TABLE profiles DROP COLUMN IF EXISTS current_position;
ALTER TABLE profiles DROP COLUMN IF EXISTS rank;
ALTER TABLE profiles DROP COLUMN IF EXISTS years_of_experience;
;
