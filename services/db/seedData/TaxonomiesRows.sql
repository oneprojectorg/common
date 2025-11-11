-- Note: Since we wipe the database before seeding, we don't need ON CONFLICT clauses
INSERT INTO "public"."taxonomies" ("id", "name", "description", "namespace_uri", "created_at", "updated_at", "deleted_at") 
VALUES 
  ('ad45a607-0d5d-4c9e-83c7-4ad9a44f3d81', 'NECFunding', 'NEC Simple Funding', 'necFunding', '2025-05-18 18:40:47.089319+00', '2025-05-18 18:40:47.089319+00', null), 
  ('cde31035-40b4-4e5b-963d-49b9e7ddd8d4', 'splcStrategies', null, 'splcStrategies', '2025-05-01 23:41:06.718322+00', '2025-05-01 23:41:06.718322+00', null), 
  ('d81c255a-7e12-436a-bb52-a52eb592b770', 'candid', 'Candid Taxonomy', 'candid', '2025-05-18 17:18:59.118654+00', '2025-05-18 17:18:59.118654+00', null), 
  ('f1bfbae2-3b2f-42b8-8b02-747ee1504399', 'NEC Simple', 'NEC Simple', 'necSimple', '2025-05-19 12:13:42.307793+00', '2025-05-19 12:13:42.307793+00', null);