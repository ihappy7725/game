-- 추가 마이그레이션. 2026-10-17 사용자 SQL Editor 적용 완료, 읽기 전용 순위 조회 검증 완료.
-- 기존 코인/가챠/아이템 확률/학습 데이터는 변경하지 않습니다.
begin;

create table if not exists public.game_records (
  user_id uuid not null references public.profiles(id) on delete cascade,
  run_id uuid not null,
  game_id text not null check (game_id in ('cab','fork','pop')),
  difficulty smallint not null check (difficulty between 0 and 2),
  stage smallint not null check (stage between 0 and 5),
  score integer not null check (score between 0 and 10000000),
  elapsed_ms integer not null check (elapsed_ms between 1 and 86400000),
  created_at timestamptz not null default now(),
  primary key (user_id, run_id),
  check ((game_id = 'pop' and stage between 1 and 5 and elapsed_ms <= 60000 and score >= 1200 + (stage-1)*800 + difficulty*400)
      or (game_id in ('cab','fork') and stage = 0))
);
create index if not exists game_records_week_idx on public.game_records(game_id, difficulty, stage, created_at desc);
alter table public.game_records enable row level security;
drop policy if exists "본인 게임 연습 기록 조회" on public.game_records;
create policy "본인 게임 연습 기록 조회" on public.game_records for select using (auth.uid() = user_id);
revoke all on public.game_records from public, anon, authenticated;
grant select on public.game_records to authenticated;
grant all on public.game_records to service_role;
comment on table public.game_records is '클라이언트가 명시적으로 제출한 게임 연습 기록. 서버 재생 검증 전이며 코인/성장 보상을 지급하지 않음';

create or replace function public.game_save_record(
  p_user_id uuid, p_run_id uuid, p_game_id text, p_difficulty integer, p_stage integer, p_score integer, p_elapsed_ms integer
) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_row public.game_records%rowtype;
  v_created boolean;
begin
  if p_user_id is null or p_run_id is null or p_game_id is null or p_difficulty is null or p_stage is null or p_score is null or p_elapsed_ms is null
    or p_game_id not in ('cab','fork','pop') or p_difficulty not between 0 and 2 or p_score not between 0 and 10000000 or p_elapsed_ms not between 1 and 86400000
    or (p_game_id = 'pop' and (p_stage not between 1 and 5 or p_elapsed_ms > 60000 or p_score < 1200+(p_stage-1)*800+p_difficulty*400))
    or (p_game_id <> 'pop' and p_stage <> 0) then
    raise exception 'INVALID_RECORD';
  end if;
  insert into public.game_records(user_id,run_id,game_id,difficulty,stage,score,elapsed_ms)
  values(p_user_id,p_run_id,p_game_id,p_difficulty,p_stage,p_score,p_elapsed_ms)
  on conflict(user_id,run_id) do nothing;
  v_created := found;
  select * into strict v_row from public.game_records where user_id=p_user_id and run_id=p_run_id;
  if (v_row.game_id,v_row.difficulty,v_row.stage,v_row.score,v_row.elapsed_ms)
     is distinct from (p_game_id,p_difficulty,p_stage,p_score,p_elapsed_ms) then
    raise exception 'RECORD_CONFLICT';
  end if;
  return jsonb_build_object('saved',true,'created',v_created,'run_id',p_run_id,'verification','client_reported');
end;
$$;

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
      'rank',ranking,'display_name','유니온 ' || substr(md5(user_id::text),1,6),
      'score',score,'elapsed_ms',elapsed_ms,'is_me',user_id=p_user_id
    ) order by ranking,created_at,user_id) from top_rows),'[]'::jsonb),
    'my_rank',(select ranking from ranked where user_id=p_user_id),
    'week_start',v_start,'week_end',v_end,'verification','client_reported'
  ) into v_result;
  return v_result;
end;
$$;
revoke all on function public.game_save_record(uuid,uuid,text,integer,integer,integer,integer) from public, anon, authenticated;
revoke all on function public.game_record_leaderboard(uuid,text,integer,integer,integer) from public, anon, authenticated;
grant execute on function public.game_save_record(uuid,uuid,text,integer,integer,integer,integer) to service_role;
grant execute on function public.game_record_leaderboard(uuid,text,integer,integer,integer) to service_role;
commit;
