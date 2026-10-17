-- 읽기 전용 구조 검사입니다. 모든 열이 true인지 확인합니다.
select
  to_regprocedure('public.game_public_profile(uuid)') is not null as profile_function_exists,
  exists(select 1 from information_schema.columns where table_schema='public' and table_name='game_weekly_leaderboard' and column_name='avatar_id') as coin_avatar_exists,
  coalesce(not has_function_privilege('anon',to_regprocedure('public.game_public_profile(uuid)'),'execute'),false) as anon_profile_blocked,
  coalesce(not has_function_privilege('authenticated',to_regprocedure('public.game_public_profile(uuid)'),'execute'),false) as direct_profile_blocked,
  coalesce(has_function_privilege('service_role',to_regprocedure('public.game_public_profile(uuid)'),'execute'),false) as backend_profile_allowed,
  coalesce(not has_table_privilege('anon',to_regclass('public.game_weekly_leaderboard'),'select'),false) as anon_ranking_blocked,
  coalesce(position('profiles_ready' in pg_get_functiondef(to_regprocedure('public.game_record_leaderboard(uuid,text,integer,integer,integer)')))>0,false) as game_profile_ready;
