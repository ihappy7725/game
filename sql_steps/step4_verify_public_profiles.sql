-- 읽기 전용 구조 검사입니다. 모든 열이 true인지 확인합니다.
select
  to_regprocedure('public.game_public_profile(uuid)') is not null as profile_function_exists,
  exists(select 1 from information_schema.columns where table_schema='public' and table_name='game_weekly_leaderboard' and column_name='avatar_id') as coin_avatar_exists,
  not has_function_privilege('anon','public.game_public_profile(uuid)','execute') as anon_profile_blocked,
  not has_function_privilege('authenticated','public.game_public_profile(uuid)','execute') as direct_profile_blocked,
  has_function_privilege('service_role','public.game_public_profile(uuid)','execute') as backend_profile_allowed,
  not has_table_privilege('anon','public.game_weekly_leaderboard','select') as anon_ranking_blocked,
  position('profiles_ready' in pg_get_functiondef('public.game_record_leaderboard(uuid,text,integer,integer,integer)'::regprocedure))>0 as game_profile_ready;
