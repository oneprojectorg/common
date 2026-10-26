-- Describe one decision's voting process as one JSON document, end to end.
-- Usage:
--   psql "$DATABASE_URL" -v slug=sms-voting-test -At -f packages/common/src/scripts/describeDecisionProcess.sql

with decision as (
  select p.id as profile_id, p.slug, p.name, i.id as instance_id, i.process_id,
         i.status, i.current_state_id, i.next_short_code, i.owner_profile_id,
         i.instance_data
    from profiles p
    join decision_process_instances i on i.profile_id = p.id
   where p.slug = :'slug'
     and p.deleted_at is null and i.deleted_at is null
)
select jsonb_pretty(jsonb_build_object(
  'decision', (select jsonb_build_object(
      'profile_id', d.profile_id, 'slug', d.slug, 'name', d.name,
      'instance_id', d.instance_id, 'status', d.status,
      'current_phase', d.current_state_id, 'next_short_code', d.next_short_code,
      'owner_profile', (select o.slug from profiles o where o.id = d.owner_profile_id)
    ) from decision d),

  'template', (select jsonb_build_object(
      'id', t.id, 'name', t.name,
      'phases', (select jsonb_agg(ph->>'id') from jsonb_array_elements(t.process_schema->'phases') ph)
    ) from decision d join decision_processes t on t.id = d.process_id),

  'phases', (select jsonb_agg(jsonb_build_object(
      'phase', ph->>'phaseId', 'name', ph->>'name',
      'voting', ph->'rules'->'voting', 'proposals', ph->'rules'->'proposals'
    )) from decision d, jsonb_array_elements(d.instance_data->'phases') ph),

  'transitions', (select coalesce(jsonb_agg(jsonb_build_object(
      'from', h.from_state_id, 'to', h.to_state_id, 'at', h.transitioned_at
    ) order by h.transitioned_at), '[]'::jsonb)
    from decision d join decision_transition_history h on h.process_instance_id = d.instance_id),

  'access', (select jsonb_agg(jsonb_build_object(
      'auth_user_id', pu.auth_user_id, 'email', pu.email,
      'role', r.name,
      'decisions_zone_bits', (select a.permission
                                from access_role_permissions_on_access_zones a
                               where a.access_role_id = r.id and a.profile_id = d.profile_id
                                 and a.access_zone_id = '00000000-0000-4000-8000-000000000003')
    ))
    from decision d
    join profile_users pu on pu.profile_id = d.profile_id and pu.deleted_at is null
    left join "profileUser_to_access_roles" pr on pr.profile_user_id = pu.id
    left join access_roles r on r.id = pr.access_role_id),

  'chat_lines', (select coalesce(jsonb_agg(l.phone_number), '[]'::jsonb)
    from decision d join decision_chat_lines l on l.process_instance_id = d.instance_id and l.deleted_at is null),

  'districts', (select jsonb_agg(jsonb_build_object(
      'boundary_id', b.id, 'name', b.name, 'category_term', t.label,
      'bbox', ST_AsText(ST_Envelope(b.boundary))
    ) order by b.name)
    from decision d
    join decision_boundaries b on b.profile_id = d.profile_id and b.deleted_at is null
    left join "taxonomyTerms" t on t.id = b.taxonomy_term_id),

--   'proposals', (select jsonb_agg(jsonb_build_object(
--       'code', pr.short_code, 'title', pr.proposal_data->>'title',
--       'status', pr.status, 'budget', pr.proposal_data->'budget',
--       'location', pr.proposal_data->'location',
--       'districts', (select jsonb_agg(t.label)
--                       from decision_categories c join "taxonomyTerms" t on t.id = c.taxonomy_term_id
--                      where c.proposal_id = pr.id),
--       'proposal_profile', (select pp.slug from profiles pp where pp.id = pr.profile_id)
--     ) order by pr.short_code)
--     from decision d join decision_proposals pr on pr.process_instance_id = d.instance_id and pr.deleted_at is null),

  'voter_enrolments', (select coalesce(jsonb_agg(jsonb_build_object(
      'voter_profile', (select vp.slug from profiles vp where vp.id = e.profile_id),
      'status', e.status,
      'district', (select b.name from decision_boundaries b where b.id = e.boundary_id),
      'attested_at', e.attested_at, 'attestation_hash', left(e.attestation_hash, 12)
    ) order by e.created_at), '[]'::jsonb)
    from decision d join decision_voter_enrolments e on e.process_instance_id = d.instance_id and e.deleted_at is null),

  'ballot_drafts', (select coalesce(jsonb_agg(jsonb_build_object(
      'voter_profile', (select vp.slug from profiles vp where vp.id = bd.profile_id),
      'picks', bd.picks, 'page_cursor', bd.page_cursor, 'reopened_at', bd.reopened_at
    )), '[]'::jsonb)
    from decision d join decision_ballot_drafts bd on bd.process_instance_id = d.instance_id and bd.deleted_at is null),

  'cast_ballots', (select coalesce(jsonb_agg(jsonb_build_object(
      'submission_id', s.id,
      'voter_profile', (select vp.slug from profiles vp where vp.id = s.submitted_by_profile_id),
      'cast_at', s.created_at, 'updated_at', s.updated_at,
      'schema_type', s.vote_data->>'schemaType', 'total_cost', s.vote_data->'totalCost',
      'picks', (select jsonb_agg(jsonb_build_object('rank', vp.rank, 'code', p2.short_code, 'title', p2.proposal_data->>'title')
                                 order by vp.rank nulls last, vp.created_at)
                  from decisions_vote_proposals vp join decision_proposals p2 on p2.id = vp.proposal_id
                 where vp.vote_submission_id = s.id and vp.deleted_at is null)
    ) order by s.created_at), '[]'::jsonb)
    from decision d join decisions_vote_submissions s on s.process_instance_id = d.instance_id and s.deleted_at is null)
));
