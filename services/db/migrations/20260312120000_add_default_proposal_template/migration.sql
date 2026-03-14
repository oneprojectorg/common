UPDATE decision_processes
SET process_schema = jsonb_set(
  process_schema,
  '{proposalTemplate}',
  '{"type":"object","properties":{"title":{"type":"string","title":"Proposal title","x-format":"short-text"},"summary":{"type":"string","title":"Proposal summary","x-format":"long-text"},"budget":{"type":"object","title":"Budget","x-format":"money","properties":{"amount":{"type":"number"},"currency":{"type":"string","default":"USD"}}}},"x-field-order":["title","budget","summary"],"required":["title","summary"]}'::jsonb
)
WHERE process_schema IS NOT NULL
  AND process_schema ? 'id'
  AND process_schema->'proposalTemplate' IS NULL;
