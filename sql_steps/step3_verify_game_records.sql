-- step3_game_records.sql 적용 후 SQL Editor에서 실행합니다.
-- 메타데이터와 순위 응답 형식만 조회하며 테스트 계정·기록을 추가하지 않습니다.
begin read only;

select
  to_regclass('public.game_records') is not null as table_exists,
  (select relrowsecurity from pg_class where oid = to_regclass('public.game_records')) as rls_enabled,
  has_table_privilege('authenticated', to_regclass('public.game_records'), 'SELECT') as member_can_read,
  not has_table_privilege('anon', to_regclass('public.game_records'), 'SELECT') as guest_cannot_read,
  not has_table_privilege('authenticated', to_regclass('public.game_records'), 'INSERT,UPDATE,DELETE') as member_cannot_write,
  (has_table_privilege('service_role', to_regclass('public.game_records'), 'SELECT')
   and has_table_privilege('service_role', to_regclass('public.game_records'), 'INSERT')) as backend_can_access;

select policyname, cmd, roles, qual
from pg_policies where schemaname = 'public' and tablename = 'game_records';

with targets(signature) as (values
  ('public.game_save_record(uuid,uuid,text,integer,integer,integer,integer)'),
  ('public.game_record_leaderboard(uuid,text,integer,integer,integer)')
)
select signature,
  p.oid is not null as function_exists,
  p.prosecdef as security_definer,
  p.proconfig as function_settings,
  has_function_privilege('service_role', p.oid, 'EXECUTE') as backend_can_execute,
  not has_function_privilege('anon', p.oid, 'EXECUTE') as guest_cannot_execute,
  not has_function_privilege('authenticated', p.oid, 'EXECUTE') as member_cannot_execute,
  not exists (
    select 1 from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
    where a.grantee = 0 and a.privilege_type = 'EXECUTE'
  ) as public_cannot_execute
from targets left join pg_proc p on p.oid = to_regprocedure(signature);

-- 사용자 정보를 출력하지 않고 실제 함수가 실행되는지만 확인합니다.
-- 영(0) UUID는 조회 인자이며 사용자나 게임 기록을 생성하지 않습니다.
with responses as (
  select game_id, public.game_record_leaderboard(
    '00000000-0000-0000-0000-000000000000'::uuid, game_id, 0,
    case when game_id = 'pop' then 1 else 0 end, 20
  ) as result
  from (values ('cab'), ('fork'), ('pop')) games(game_id)
)
select game_id,
  jsonb_typeof(result->'rows') = 'array' as rows_are_array,
  result ? 'my_rank' as has_my_rank,
  (result->>'week_end')::timestamptz - (result->>'week_start')::timestamptz = interval '7 days' as seven_day_week,
  extract(isodow from ((result->>'week_start')::timestamptz at time zone 'Asia/Seoul')) = 1 as starts_on_korean_monday,
  ((result->>'week_start')::timestamptz at time zone 'Asia/Seoul')::time = time '00:00' as starts_at_korean_midnight,
  result->>'verification' = 'client_reported' as practice_ranking
from responses;

rollback;
