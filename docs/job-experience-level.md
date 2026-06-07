# Job Experience Level 

## Overview
The `jobs.experience_level` column was added to the Supabase database schema to resolve a mismatch where the application UI (`EditProfessionalJobForm`) was allowing users to select an experience level, but the database lacked the corresponding column.

## Schema Update
The column was added via `jobs_experience_level_schema_fix.sql` with the following configuration:
* Type: `text`
* Default: `'Mid'`
* Allowed Values (Constraint): `'Entry Level', 'Junior', 'Mid', 'Senior', 'Specialist', 'Expert'`

## Application Integration
* **Create/Edit Job Form**: The form now successfully maps the selected experience level to the database payload upon insert and update operations.
* **Opportunity Job List**: Experience level is displayed as a distinct indigo pill/chip on the `JobCard` to help candidates filter jobs.
* **Logbook Feed Integration**: When a job is edited, the related snapshot stored inside `logbook_posts` is silently regenerated to reflect the updated data (including the new experience level pill and tags) without breaking legacy post rendering.
