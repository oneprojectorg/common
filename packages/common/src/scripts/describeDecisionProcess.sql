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

  -- Who holds a grant on the decision's profile. The sentinel auth user
  -- 00000000-0000-4000-a000-000000000001 (GLOBAL_USER_PUBLIC in packages/core)
  -- stands in for anyone with no session: a row for it is the public grant
  -- that makeDecisionPublic writes. Permission bits: access-zones ACRUD
  -- (DELETE 1, UPDATE 2, READ 4, CREATE 8, ADMIN 16) plus the decision bits
  -- (INVITE_MEMBERS 32, REVIEW 64, SUBMIT_PROPOSALS 128, VOTE 256).
  'access', (select jsonb_agg(jsonb_build_object(
      'who', case when pu.auth_user_id = '00000000-0000-4000-a000-000000000001'
                  then 'public: anyone, signed in or not (GLOBAL_USER_PUBLIC)'
                  else coalesce(pu.email, pu.name, pu.auth_user_id::text) end,
      'auth_user_id', pu.auth_user_id,
      'is_owner', pu.is_owner,
      'role', r.name,
      'role_scope', case when r.profile_id is null then 'global role' else 'role defined on this decision' end,
      'permissions', (select coalesce(jsonb_object_agg(z.name, jsonb_build_object(
            'bits', a.permission,
            'can', (select coalesce(jsonb_agg(n order by o), '[]'::jsonb)
                      from (values (1, 'delete', 1), (2, 'update', 2), (4, 'read', 3), (8, 'create', 4),
                                   (16, 'admin', 5), (32, 'invite_members', 6), (64, 'review', 7),
                                   (128, 'submit_proposals', 8), (256, 'vote', 9)) as bit(v, n, o)
                     where (a.permission & bit.v) <> 0))), '{}'::jsonb)
          from access_role_permissions_on_access_zones a
          join access_zones z on z.id = a.access_zone_id
         where a.access_role_id = r.id and a.deleted_at is null
           and (a.profile_id = d.profile_id or a.profile_id is null))
    ) order by pu.is_owner desc, r.name)
    from decision d
    join profile_users pu on pu.profile_id = d.profile_id and pu.deleted_at is null
    left join "profileUser_to_access_roles" pr on pr.profile_user_id = pu.id
    left join access_roles r on r.id = pr.access_role_id),

  'chat_lines', (select coalesce(jsonb_agg(jsonb_build_object(
      'line_id', l.id,
      'phone_number', l.phone_number,
      'bound_to', jsonb_build_object(
        'process_instance_id', l.process_instance_id,
        'decision', d.name, 'slug', d.slug, 'status', d.status,
        'process_id', d.process_id, 'current_phase', d.current_state_id),
      'drafts_browsed_on_this_line', (select count(*) from decision_ballot_drafts bd where bd.chat_line_id = l.id),
      'bound_at', l.created_at
    ) order by l.created_at), '[]'::jsonb)
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

  -- Every GoTrue user that signed up by phone (the SMS signup path), with
  -- the profile GoTrue's trigger gave them and where they stand on this
  -- decision. Phone numbers are stored by GoTrue without the leading +.
  'phone_accounts', (select coalesce(jsonb_agg(acct order by active desc, confirmed desc nulls last), '[]'::jsonb)
    from decision d, lateral (
      select au.phone_confirmed_at as confirmed,
             (e.id is not null or bd.id is not null or cs.id is not null) as active,
             jsonb_build_object(
               'phone', '+' || au.phone,
               'auth_user_id', au.id,
               'profile', vp.slug || ' (' || vp.name || ')',
               'phone_confirmed_at', au.phone_confirmed_at,
               'last_sign_in_at', au.last_sign_in_at,
               'on_this_decision', case when e.id is null and bd.id is null and cs.id is null then to_jsonb('nothing yet'::text)
                 else jsonb_build_object(
                   'enrolment', case when e.id is null then null else jsonb_build_object('status', e.status,
                       'district', (select b.name from decision_boundaries b where b.id = e.boundary_id)) end,
                   'draft_picks', case when bd.id is null then null else jsonb_array_length(bd.picks) end,
                   'cast_ballot_id', cs.id) end
             ) as acct
        from auth.users au
        left join users u on u.auth_user_id = au.id
        left join profiles vp on vp.id = u.current_profile_id
        left join decision_voter_enrolments e on e.process_instance_id = d.instance_id and e.profile_id = u.current_profile_id and e.deleted_at is null
        left join decision_ballot_drafts bd on bd.process_instance_id = d.instance_id and bd.profile_id = u.current_profile_id and bd.deleted_at is null
        left join lateral (select cs.id from decisions_vote_submissions cs
                            where cs.process_instance_id = d.instance_id and cs.submitted_by_profile_id = u.current_profile_id and cs.deleted_at is null
                            order by cs.created_at desc limit 1) cs on true
       where au.phone is not null and au.deleted_at is null) x),

  -- One row per voter and decision: where the registration conversation is.
  'decision_voter_enrolments', (select coalesce(jsonb_agg(jsonb_build_object(
      'id', e.id,
      'voter_profile', (select vp.slug from profiles vp where vp.id = e.profile_id),
      'voter_phone', (select '+' || au.phone from users u join auth.users au on au.id = u.auth_user_id where u.current_profile_id = e.profile_id limit 1),
      'profile_id', e.profile_id,
      'status', e.status,
      'boundary_id', e.boundary_id,
      'district', (select b.name from decision_boundaries b where b.id = e.boundary_id),
      'attestation_hash', e.attestation_hash,
      'attested_at', e.attested_at,
      'created_at', e.created_at, 'updated_at', e.updated_at
    ) order by e.created_at), '[]'::jsonb)
    from decision d join decision_voter_enrolments e on e.process_instance_id = d.instance_id and e.deleted_at is null),

  -- One row per voter and decision: the ballot between the first code and SUBMIT.
  'decision_ballot_drafts', (select coalesce(jsonb_agg(jsonb_build_object(
      'id', bd.id,
      'voter_profile', (select vp.slug from profiles vp where vp.id = bd.profile_id),
      'voter_phone', (select '+' || au.phone from users u join auth.users au on au.id = u.auth_user_id where u.current_profile_id = bd.profile_id limit 1),
      'profile_id', bd.profile_id,
      'picks', bd.picks,
      'picks_resolved', (select coalesce(jsonb_agg(jsonb_build_object('rank', pk.ordinality, 'code', p2.short_code, 'title', p2.proposal_data->>'title') order by pk.ordinality), '[]'::jsonb)
                           from jsonb_array_elements_text(bd.picks) with ordinality as pk(proposal_id, ordinality)
                           left join decision_proposals p2 on p2.id::text = pk.proposal_id),
      'page_cursor', bd.page_cursor,
      'chat_line_id', bd.chat_line_id,
      'chat_line', (select l.phone_number from decision_chat_lines l where l.id = bd.chat_line_id),
      'reopened_at', bd.reopened_at,
      'created_at', bd.created_at, 'updated_at', bd.updated_at
    ) order by bd.created_at), '[]'::jsonb)
    from decision d join decision_ballot_drafts bd on bd.process_instance_id = d.instance_id and bd.deleted_at is null),

  -- The cast ballots: one decisions_vote_submissions row per voter (SUBMIT
  -- deletes the draft and writes this; CHANGE + SUBMIT revises it in place),
  -- with its decisions_vote_proposals rows in rank order. vote_data is what
  -- submitVote stored: selections with cost and rank, the total, the unit.
  'decisions_vote_submissions', (select coalesce(jsonb_agg(jsonb_build_object(
      'id', s.id,
      'voter_profile', (select vp.slug from profiles vp where vp.id = s.submitted_by_profile_id),
      'voter_phone', (select '+' || au.phone from users u join auth.users au on au.id = u.auth_user_id where u.current_profile_id = s.submitted_by_profile_id limit 1),
      'profile_id', s.submitted_by_profile_id,
      'cast_at', s.created_at, 'updated_at', s.updated_at,
      'revised', s.updated_at > s.created_at + interval '1 second',
      'voter_was_enrolled', exists (select 1 from decision_voter_enrolments e
                                      where e.process_instance_id = s.process_instance_id and e.profile_id = s.submitted_by_profile_id
                                        and e.status = 'enrolled' and e.deleted_at is null),
      'draft_still_present', exists (select 1 from decision_ballot_drafts bd
                                       where bd.process_instance_id = s.process_instance_id and bd.profile_id = s.submitted_by_profile_id and bd.deleted_at is null),
      'vote_data', s.vote_data,
      'selections', (select coalesce(jsonb_agg(jsonb_build_object(
                         'rank', vp.rank, 'code', p2.short_code, 'title', p2.proposal_data->>'title', 'proposal_id', vp.proposal_id,
                         'cost', (select sel->'cost' from jsonb_array_elements(s.vote_data->'selections') sel where sel->>'proposalId' = vp.proposal_id::text limit 1))
                         order by vp.rank nulls last, vp.created_at), '[]'::jsonb)
                       from decisions_vote_proposals vp join decision_proposals p2 on p2.id = vp.proposal_id
                      where vp.vote_submission_id = s.id and vp.deleted_at is null)
    ) order by s.created_at), '[]'::jsonb)
    from decision d join decisions_vote_submissions s on s.process_instance_id = d.instance_id and s.deleted_at is null),

  -- How the ballots add up: per proposal, how many ballots picked it, at what
  -- ranks, and the cost each ballot charged for it. Proof that SUBMIT landed
  -- where the web tally reads.
  'tally', (select jsonb_build_object(
      'ballots', (select count(*) from decisions_vote_submissions s where s.process_instance_id = d.instance_id and s.deleted_at is null),
      'voters_enrolled', (select count(*) from decision_voter_enrolments e where e.process_instance_id = d.instance_id and e.status = 'enrolled' and e.deleted_at is null),
      'drafts_open', (select count(*) from decision_ballot_drafts bd where bd.process_instance_id = d.instance_id and bd.deleted_at is null),
      'by_proposal', (select coalesce(jsonb_agg(jsonb_build_object(
            'code', t.code, 'title', t.title, 'votes', t.votes, 'ranks', t.ranks, 'first_choices', t.first_choices
          ) order by t.votes desc, t.code), '[]'::jsonb)
          from (select p.short_code as code, p.proposal_data->>'title' as title,
                       count(vp.vote_submission_id) as votes,
                       coalesce(jsonb_agg(vp.rank order by vp.rank) filter (where vp.rank is not null), '[]'::jsonb) as ranks,
                       count(*) filter (where vp.rank = 1) as first_choices
                  from decision_proposals p
                  left join decisions_vote_proposals vp on vp.proposal_id = p.id and vp.deleted_at is null
                  left join decisions_vote_submissions s on s.id = vp.vote_submission_id and s.deleted_at is null
                 where p.process_instance_id = d.instance_id and p.deleted_at is null and p.short_code is not null
                 group by p.id, p.short_code, p.proposal_data->>'title') t)
    ) from decision d),

  -- The results run, if the phase advanced past voting and the selection
  -- pipeline executed: which proposals were selected and how much each got.
  'results', (select coalesce(jsonb_agg(jsonb_build_object(
      'id', r.id, 'executed_at', r.executed_at, 'success', r.success, 'error', r.error_message,
      'voter_count', r.voter_count, 'selected_count', r.selected_count,
      'selected', (select coalesce(jsonb_agg(jsonb_build_object('rank', rs.selection_rank, 'code', p2.short_code, 'title', p2.proposal_data->>'title', 'allocated', rs.allocated) order by rs.selection_rank), '[]'::jsonb)
                     from decision_process_result_selections rs join decision_proposals p2 on p2.id = rs.proposal_id
                    where rs.process_result_id = r.id and rs.deleted_at is null)
    ) order by r.executed_at desc nulls last), '[]'::jsonb)
    from decision d join decision_process_results r on r.process_instance_id = d.instance_id and r.deleted_at is null)
));
