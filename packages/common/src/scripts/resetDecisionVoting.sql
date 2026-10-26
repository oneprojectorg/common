-- Reset every voter's state on one decision so the SMS flow can be demoed again:
-- cast ballots, draft ballots and registrations. Proposals, districts, access and
-- the chat line stay. Rows are hard-deleted because the unique keys on
-- (process_instance_id, profile_id) would block a voter from registering again.
-- Usage:
--   psql "$DATABASE_URL" -v slug=sms-voting-test -At -f packages/common/src/scripts/resetDecisionVoting.sql

begin;

with decision as (
  select i.id as instance_id
    from profiles p
    join decision_process_instances i on i.profile_id = p.id
   where p.slug = :'slug'
     and p.deleted_at is null and i.deleted_at is null
),
picks as (
  delete from decisions_vote_proposals vp
   using decisions_vote_submissions s, decision d
   where vp.vote_submission_id = s.id and s.process_instance_id = d.instance_id
  returning vp.proposal_id
),
ballots as (
  delete from decisions_vote_submissions s
   using decision d
   where s.process_instance_id = d.instance_id
  returning s.id
),
drafts as (
  delete from decision_ballot_drafts bd
   using decision d
   where bd.process_instance_id = d.instance_id
  returning bd.id
),
registrations as (
  delete from decision_voter_enrolments e
   using decision d
   where e.process_instance_id = d.instance_id
  returning e.id
)
select jsonb_pretty(jsonb_build_object(
  'decision', (select instance_id from decision),
  'deleted', jsonb_build_object(
    'vote_picks', (select count(*) from picks),
    'cast_ballots', (select count(*) from ballots),
    'ballot_drafts', (select count(*) from drafts),
    'registrations', (select count(*) from registrations)
  )
));

commit;
