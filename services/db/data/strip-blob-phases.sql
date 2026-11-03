-- Removes the phases key from every decision's instance_data.
--
-- Run it only in release 4, after the app no longer falls back to reading
-- instance_data.phases. Before that, it deletes the only copy of the phases
-- for any decision without phase rows. Run check-phase-drift.sql first and
-- confirm it returns zero rows.
--
-- Run by hand with psql against each environment, never through migrate:
--   psql "$DATABASE_URL" -f services/db/data/strip-blob-phases.sql
UPDATE decision_process_instances
SET instance_data = instance_data - 'phases'
WHERE instance_data ? 'phases';
