-- Remove the account behind one phone number so the SMS signup can be demoed
-- again from JOIN: the GoTrue user, its public rows and everything the
-- profile owns in a decision (registrations, drafts, cast ballots cascade from
-- the profile). Nothing else references the number. Local use only.
-- Usage:
--   psql "$DATABASE_URL" -v phone=+18182124554 -At -f packages/common/src/scripts/resetSmsAccount.sql

begin;

with account as (
  select id as auth_user_id
    from auth.users
   where phone = ltrim(:'phone', '+') or phone = :'phone'
), owned as (
  select u.id as user_id, u.current_profile_id as profile_id, a.auth_user_id
    from account a
    left join users u on u.auth_user_id = a.auth_user_id
), v as (
  delete from verifications
   where auth_user_id in (select auth_user_id from account)
  returning 1
), pv as (
  delete from phone_verifications
   where auth_user_id in (select auth_user_id from account)
  returning 1
), p as (
  delete from profiles
   where id in (select profile_id from owned where profile_id is not null)
  returning 1
), u as (
  delete from users
   where auth_user_id in (select auth_user_id from account)
  returning 1
), g as (
  delete from auth.users
   where id in (select auth_user_id from account)
  returning 1
)
select 'verifications' as deleted, count(*) from v
union all select 'phone_verifications', count(*) from pv
union all select 'profiles (with their registrations, drafts and ballots)', count(*) from p
union all select 'users', count(*) from u
union all select 'auth.users', count(*) from g;

commit;
