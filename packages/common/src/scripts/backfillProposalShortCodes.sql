BEGIN;

SELECT id, next_short_code
FROM decision_process_instances
WHERE deleted_at IS NULL
FOR UPDATE;

WITH numbered AS (
  SELECT
    p.id,
    i.next_short_code - 1 + row_number() OVER (
      PARTITION BY p.process_instance_id
      ORDER BY p.created_at, p.id
    ) AS code
  FROM decision_proposals p
  JOIN decision_process_instances i ON i.id = p.process_instance_id
  WHERE p.deleted_at IS NULL
    AND p.moderation_detached_at IS NULL
    AND p.status NOT IN ('draft', 'rejected', 'duplicate')
    AND p.short_code IS NULL
    AND i.deleted_at IS NULL
)
UPDATE decision_proposals p
SET short_code = n.code
FROM numbered n
WHERE p.id = n.id;

UPDATE decision_process_instances i
SET next_short_code = coded.max_code + 1
FROM (
  SELECT process_instance_id, max(short_code) AS max_code
  FROM decision_proposals
  WHERE short_code IS NOT NULL
  GROUP BY process_instance_id
) coded
WHERE coded.process_instance_id = i.id
  AND coded.max_code >= i.next_short_code;

SELECT
  i.id AS instance_id,
  i.next_short_code,
  count(*) FILTER (WHERE p.short_code IS NOT NULL) AS coded,
  count(*) FILTER (
    WHERE p.short_code IS NULL
      AND p.status NOT IN ('draft', 'rejected', 'duplicate')
      AND p.moderation_detached_at IS NULL
  ) AS still_missing
FROM decision_process_instances i
LEFT JOIN decision_proposals p
  ON p.process_instance_id = i.id
 AND p.deleted_at IS NULL
WHERE i.deleted_at IS NULL
GROUP BY i.id, i.next_short_code
ORDER BY coded DESC;

COMMIT;
