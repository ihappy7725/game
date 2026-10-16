-- ============================================================================
-- TOEFL High-Score Helper - Supabase 스키마 (DDL)
-- Supabase 대시보드 > SQL Editor 에 전체를 붙여넣고 한 번에 실행하세요.
-- 반복 실행해도 안전하도록 작성되어 있습니다 (idempotent).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. profiles : auth.users 를 1:1로 확장하는 사용자 프로필
-- ----------------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid        primary key references auth.users (id) on delete cascade,
  email       text,
  full_name   text,
  avatar_url  text,
  target_score smallint    check (target_score between 0 and 120),
  test_date   date,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.profiles is 'auth.users 1:1 확장 프로필';

-- ----------------------------------------------------------------------------
-- 2. submissions : 모든 섹션의 제출/채점 기록
--    writing  -> user_response 에 에세이, corrected_text 에 교정 에세이
--    speaking -> user_response/transcript 에 STT 결과, corrected_text 에 모범 답안
-- ----------------------------------------------------------------------------
create table if not exists public.submissions (
  id               uuid        primary key default gen_random_uuid(),
  user_id          uuid        references public.profiles (id) on delete cascade,
  section          text        not null
                               check (section in ('writing', 'speaking', 'reading', 'listening')),
  task_type        text,
  question_prompt  text,
  user_response    text,
  transcript       text,
  audio_url        text,
  word_count       integer     check (word_count >= 0),
  duration_seconds numeric(6, 2) check (duration_seconds >= 0),
  estimated_score  numeric(4, 1) check (estimated_score between 0 and 30),
  rubric_score     numeric(3, 1) check (rubric_score between 0 and 5),
  breakdown        jsonb       not null default '{}'::jsonb,
  actionable_tips  jsonb       not null default '[]'::jsonb,
  corrected_text   text,
  summary          text,
  model            text,
  created_at       timestamptz not null default now()
);

comment on table public.submissions is '섹션별 제출 원문과 AI 채점 결과';
comment on column public.submissions.breakdown is '{항목: {score, comment}} 형태의 루브릭 세부 점수';

-- 히스토리 대시보드용 인덱스 (최신순 조회 / 섹션별 통계)
create index if not exists submissions_user_created_idx
  on public.submissions (user_id, created_at desc);
create index if not exists submissions_user_section_created_idx
  on public.submissions (user_id, section, created_at desc);

-- ----------------------------------------------------------------------------
-- 3. updated_at 자동 갱신 트리거
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 4. 회원가입 시 프로필 자동 생성 트리거
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- 5. RLS : 본인 데이터만 접근 가능
--    백엔드는 service_role 키를 쓰므로 RLS를 우회합니다.
--    아래 정책은 프론트엔드(anon 키)의 직접 조회를 보호합니다.
-- ----------------------------------------------------------------------------
alter table public.profiles    enable row level security;
alter table public.submissions enable row level security;

drop policy if exists "본인 프로필 조회" on public.profiles;
create policy "본인 프로필 조회" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "본인 프로필 생성" on public.profiles;
create policy "본인 프로필 생성" on public.profiles
  for insert with check (auth.uid() = id);

drop policy if exists "본인 프로필 수정" on public.profiles;
create policy "본인 프로필 수정" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "본인 제출 기록 조회" on public.submissions;
create policy "본인 제출 기록 조회" on public.submissions
  for select using (auth.uid() = user_id);

drop policy if exists "본인 제출 기록 생성" on public.submissions;
create policy "본인 제출 기록 생성" on public.submissions
  for insert with check (auth.uid() = user_id);

drop policy if exists "본인 제출 기록 삭제" on public.submissions;
create policy "본인 제출 기록 삭제" on public.submissions
  for delete using (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- 6. 대시보드 통계 뷰 (security_invoker: 조회하는 사용자의 RLS가 적용됨)
-- ----------------------------------------------------------------------------
create or replace view public.submission_stats
with (security_invoker = on) as
select
  user_id,
  section,
  count(*)                                              as attempts,
  round(avg(estimated_score), 1)                         as avg_score,
  max(estimated_score)                                   as best_score,
  round(avg(estimated_score) filter (
    where created_at > now() - interval '14 days'), 1)    as avg_score_14d,
  max(created_at)                                        as last_attempt_at
from public.submissions
where user_id is not null
group by user_id, section;

comment on view public.submission_stats is '사용자·섹션별 응시 횟수와 평균/최고 점수';
