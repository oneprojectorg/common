-- Import geographic boundaries from GeoJSON into `decision_boundaries`, creating
-- and linking a matching proposal category term for each (the SQL equivalent of
-- the former importBoundaries.ts script — run it directly, no Node required).
--
-- Usage:
--   1. Edit the `params` CTE below: paste your GeoJSON (a Feature or
--      FeatureCollection) between the $$ … $$ markers, and set `name_property`
--      to the Feature property whose value is the boundary name + category label.
--   2. Run the whole statement against the target database (psql, Studio, etc.).
--
-- Requires PostGIS. Idempotent: re-running updates boundaries matched
-- case-insensitively by name (and their category terms) in place. Run inside a
-- transaction so a malformed geometry rolls the whole import back.
--
-- The `RETURNING` at the end lists each boundary touched and whether it was
-- newly inserted (true) or updated (false).
--
-- Note: the term URI is slugified in SQL (lowercase, non-alphanumeric runs → "-",
-- trimmed). This matches plain ASCII names; for names with accents/symbols the
-- slug may differ from the JS `slugify` an admin-created category would produce.
-- The term is matched by label downstream, so this only risks a duplicate term.
-- For accented names, wrap the name in `unaccent(...)` (needs the unaccent
-- extension) inside the `slugged` CTE.

WITH params AS (
  SELECT
    $$PASTE_YOUR_GEOJSON_HERE$$::jsonb AS geojson,        -- a Feature or FeatureCollection
    'NAME'                             AS name_property     -- property holding the boundary name
),
-- Ensure the 'proposal' taxonomy exists; DO UPDATE (no-op) so we always get the id back.
proposal_taxonomy AS (
  INSERT INTO taxonomies (name, description)
  VALUES ('proposal', 'Categories for organizing proposals in decision-making processes')
  ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
  RETURNING id
),
features AS (
  SELECT
    f->'geometry'                                               AS geometry,
    f->'properties'                                             AS properties,
    btrim(f->'properties'->>(SELECT name_property FROM params)) AS name
  FROM params,
       jsonb_array_elements(
         CASE WHEN geojson->>'type' = 'FeatureCollection'
              THEN geojson->'features'
              ELSE jsonb_build_array(geojson)
         END
       ) AS f
  WHERE f->'geometry' IS NOT NULL
    AND coalesce(btrim(f->'properties'->>(SELECT name_property FROM params)), '') <> ''
),
slugged AS (
  SELECT
    name, geometry, properties,
    btrim(regexp_replace(lower(name), '[^a-z0-9]+', '-', 'g'), '-') AS term_uri
  FROM features
),
-- One category term per distinct slug, linked to the proposal taxonomy.
terms AS (
  INSERT INTO "taxonomyTerms" (taxonomy_id, term_uri, label, definition)
  SELECT
    (SELECT id FROM proposal_taxonomy),
    s.term_uri,
    s.name,
    'Category for ' || s.name || ' proposals'
  FROM (
    SELECT DISTINCT ON (term_uri) term_uri, name
    FROM slugged
    ORDER BY term_uri, name
  ) s
  ON CONFLICT (taxonomy_id, term_uri) DO UPDATE SET label = EXCLUDED.label
  RETURNING id, term_uri
),
boundaries AS (
  SELECT DISTINCT ON (lower(s.name))
    s.name,
    t.id AS taxonomy_term_id,
    ST_SetSRID(
      ST_Multi(ST_CollectionExtract(ST_MakeValid(ST_GeomFromGeoJSON(s.geometry::text)), 3)),
      4326
    ) AS boundary,
    s.properties AS metadata
  FROM slugged s
  JOIN terms t ON t.term_uri = s.term_uri
  ORDER BY lower(s.name)
)
INSERT INTO decision_boundaries (name, taxonomy_term_id, boundary, metadata)
SELECT name, taxonomy_term_id, boundary, metadata FROM boundaries
ON CONFLICT (lower(name)) DO UPDATE
  SET name             = EXCLUDED.name,
      taxonomy_term_id = EXCLUDED.taxonomy_term_id,
      boundary         = EXCLUDED.boundary,
      metadata         = EXCLUDED.metadata,
      updated_at       = (now() AT TIME ZONE 'utc')
RETURNING name, (xmax = 0) AS inserted;
