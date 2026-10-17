-- 닉네임·캐릭터 공개 순위. SQL Editor에서 한 번 실행합니다.
-- 코인/아이템/게임 기록을 쓰거나 삭제하지 않습니다. 기존 이름·이메일은 공개하지 않습니다.
begin;
create or replace function public.game_public_profile(p_user_id uuid)
returns jsonb language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'nickname',case when length(trim(u.raw_user_meta_data->>'nickname')) between 2 and 20
      and trim(u.raw_user_meta_data->>'nickname') ~ '^[[:alnum:]_ -]{2,20}$'
      then trim(u.raw_user_meta_data->>'nickname') else '유니온 ' || substr(md5(p_user_id::text),1,6) end,
    'avatar_id',case when u.raw_user_meta_data->>'avatar_id' ~ '^campus-0[1-8]$'
      then u.raw_user_meta_data->>'avatar_id' else 'campus-01' end)
  from (select 1) seed left join auth.users u on u.id=p_user_id;
$$;
revoke all on function public.game_public_profile(uuid) from public, anon, authenticated;
grant execute on function public.game_public_profile(uuid) to service_role;

create or replace view public.game_weekly_leaderboard with (security_invoker = on) as
select l.user_id,
  public.game_public_profile(l.user_id)->>'nickname' as display_name,
  sum(l.amount) filter (where l.amount>0) as earned_this_week,
  count(*) filter (where l.amount>0) as events_this_week,
  max(l.created_at) as last_earned_at,
  public.game_public_profile(l.user_id)->>'avatar_id' as avatar_id
from public.game_coin_ledger l
where l.created_at>=date_trunc('week',now())
group by l.user_id;
revoke all on public.game_weekly_leaderboard from public, anon, authenticated;
grant select on public.game_weekly_leaderboard to service_role;

create or replace function public.game_record_leaderboard(
  p_user_id uuid, p_game_id text, p_difficulty integer, p_stage integer, p_limit integer default 20
) returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_start timestamptz := date_trunc('week', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul';
  v_end timestamptz := v_start + interval '7 days';
  v_result jsonb;
begin
  if p_user_id is null or p_game_id is null or p_difficulty is null or p_stage is null or p_limit is null
    or p_game_id not in ('cab','fork','pop') or p_difficulty not between 0 and 2 or p_limit not between 1 and 50
    or (p_game_id='pop' and p_stage not between 1 and 5) or (p_game_id<>'pop' and p_stage<>0) then raise exception 'INVALID_RECORD'; end if;
  with best as (
    select distinct on (r.user_id) r.*
    from public.game_records r
    where r.game_id=p_game_id and r.difficulty=p_difficulty and r.stage=p_stage and r.created_at >= v_start and r.created_at < v_end
    order by r.user_id, case when p_game_id='pop' then r.elapsed_ms else -r.score end, r.created_at, r.run_id
  ), ranked as (
    select b.*, rank() over(order by case when p_game_id='pop' then b.elapsed_ms else -b.score end) as ranking
    from best b
  ), top_rows as (
    select * from ranked order by ranking, created_at, user_id limit p_limit
  ) select jsonb_build_object(
    'rows', coalesce((select jsonb_agg(jsonb_build_object(
      'rank',ranking,'display_name',public.game_public_profile(user_id)->>'nickname',
      'avatar_id',public.game_public_profile(user_id)->>'avatar_id',
      'score',score,'elapsed_ms',elapsed_ms,'is_me',user_id=p_user_id
    ) order by ranking,created_at,user_id) from top_rows),'[]'::jsonb),
    'profiles_ready',true,
    'my_rank',(select ranking from ranked where user_id=p_user_id),
    'week_start',v_start,'week_end',v_end,'verification','client_reported'
  ) into v_result;
  return v_result;
end;
$$;
commit;
