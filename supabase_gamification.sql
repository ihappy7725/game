-- ============================================================================
-- TOEFL OS - 게임화 스키마 (코인 원장 · 티어 · 가챠 · 오답 기록 · 랭킹)
--
-- supabase_schema.sql 을 먼저 실행한 뒤 이 파일을 실행하세요 (profiles 참조).
-- 반복 실행해도 안전합니다 (idempotent).
--
-- 설계 원칙 — 코인은 "돈처럼" 다룬다
--  1. 잔액의 진실은 원장(game_coin_ledger)입니다. game_profiles.coin_balance 는
--     캐시이며 아래 함수를 통해서만 바뀝니다. 어긋나면 game_recompute_balance()
--     로 검증·복구합니다.
--  2. 잔액 검사·일일 상한 집계·원장 기록·캐시 갱신이 전부 같은 트랜잭션 안에서,
--     game_profiles 행을 FOR UPDATE 로 잠근 뒤에 일어납니다. 애플리케이션에서
--     "조회 후 지급"으로 나누면 동시 요청 두 건이 같은 잔여 상한을 읽고 둘 다
--     통과하는 레이스가 생깁니다.
--  3. 가챠 확률(game_items.weight)은 DB 안에만 있습니다. 추첨도 DB가 하므로
--     확률표가 백엔드 코드나 네트워크로 새어 나가지 않습니다.
--  4. 함수 실행과 테이블 쓰기 권한은 service_role 에게만 줍니다. Supabase 는
--     public 스키마의 새 테이블에 anon/authenticated 쓰기 권한을 기본으로 주기
--     때문에, RLS 정책만 믿지 않고 아래에서 명시적으로 REVOKE 합니다.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. game_profiles : 사용자별 게임 상태 (메뉴바가 읽는 값)
--
--    tier_level 은 캐시입니다. 승급 기준은 main.py 의 TIER_LADDER 한 곳에만
--    두고, 백엔드가 상태를 읽을 때 xp 로 다시 계산합니다. SQL 에서 티어를
--    또 계산하면 두 곳이 어긋납니다.
--
--    xp 를 코인과 분리한 이유: 코인은 가챠로 소비되므로 잔액으로 티어를 매기면
--    뽑을 때마다 강등됩니다. 누적 획득액으로 매겨도 "학습"과 "소비"가 한 숫자에
--    섞입니다. 승급은 공부한 양(xp)만 따릅니다.
-- ----------------------------------------------------------------------------
create table if not exists public.game_profiles (
  user_id          uuid        primary key references public.profiles (id) on delete cascade,
  coin_balance     bigint      not null default 0 check (coin_balance >= 0),
  total_earned     bigint      not null default 0 check (total_earned >= 0),
  total_spent      bigint      not null default 0 check (total_spent >= 0),
  xp               bigint      not null default 0 check (xp >= 0),
  tier_level       smallint    not null default 1 check (tier_level between 1 and 9),
  streak_days      integer     not null default 0 check (streak_days >= 0),
  best_streak_days integer     not null default 0 check (best_streak_days >= 0),
  last_active_date date,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

comment on table public.game_profiles is '코인 잔액·xp·티어·연속 학습일 (쓰기는 백엔드 전용)';
comment on column public.game_profiles.coin_balance is 'game_coin_ledger 합계와 일치해야 하는 캐시. game_recompute_balance() 로 검증';
comment on column public.game_profiles.tier_level is 'main.py TIER_LADDER 가 xp 로 계산한 티어의 캐시값 (1부터)';
comment on column public.game_profiles.last_active_date is 'streak 판정 기준일 (DB 타임존 = UTC)';

-- ----------------------------------------------------------------------------
-- 2. game_coin_ledger : 코인 변동 원장 (획득 = 양수, 소비 = 음수)
--
--    reason 허용값은 main.py 의 EARN_RULES / SERVER_ONLY_REASONS 와 같게
--    유지해야 합니다. 어긋나면 insert 가 거부되어 백엔드가 502 를 돌려주므로
--    조용히 틀리는 일은 없습니다.
-- ----------------------------------------------------------------------------
create table if not exists public.game_coin_ledger (
  id            bigint      generated always as identity primary key,
  user_id       uuid        not null references public.profiles (id) on delete cascade,
  amount        bigint      not null check (amount <> 0),
  reason        text        not null check (reason in (
                              -- 획득
                              'vocab_game',          -- 어휘 게임 (Yellow Cab Rush)
                              'writing_evaluated',   -- 라이팅 채점 완료
                              'speaking_evaluated',  -- 스피킹 채점 완료
                              'daily_check_in',      -- 하루 첫 접속
                              'streak_bonus',        -- 연속 학습 보너스 (서버 전용)
                              'mistake_cleared',     -- 오답 재도전 성공
                              'boss_damage',         -- Memory Boss Raid 피해량 보상
                              'tier_up',             -- 티어 승급 축하금 (서버 전용)
                              'bet_win',             -- 월스트리트 배팅 성공 (서버 전용)
                              'admin_grant',         -- 운영 보정 (서버 전용)
                              -- 소비
                              'gacha_draw',          -- 가챠 뽑기 (서버 전용)
                              'bet_stake',           -- 배팅 금액 차감
                              'bet_forfeit',         -- 배팅 실패 몰수 (서버 전용)
                              'dorm_reroll',         -- 기숙사 배치 초기화
                              'admin_revoke'         -- 운영 보정 (서버 전용)
                            )),
  balance_after bigint      not null check (balance_after >= 0),
  metadata      jsonb       not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);

comment on table public.game_coin_ledger is '코인 획득·소비 내역. 잔액의 근거이며 배팅 몰수·가챠 소비 추적용';
comment on column public.game_coin_ledger.balance_after is '이 줄을 반영한 직후 잔액 (원장만 보고도 감사 가능하도록)';
comment on column public.game_coin_ledger.metadata is 'submission_id, item_id, bet_id 등 변동의 출처';

create index if not exists game_ledger_user_created_idx
  on public.game_coin_ledger (user_id, created_at desc);
-- 사유별 "당일 획득 상한" 집계 전용. game_apply_coins 가 매 호출마다 씁니다.
create index if not exists game_ledger_user_reason_created_idx
  on public.game_coin_ledger (user_id, reason, created_at desc);

-- ----------------------------------------------------------------------------
-- 3. game_items : 가챠 카탈로그 (레퍼런스 사진 속 오브젝트들)
--
--    weight 는 추첨 가중치이며 절대 클라이언트로 나가지 않습니다.
--    is_active 로 은퇴시키면 이미 뽑은 사람의 인벤토리는 그대로 두고
--    앞으로의 추첨에서만 빠집니다.
-- ----------------------------------------------------------------------------
create table if not exists public.game_items (
  id          text        primary key,
  name        text        not null,
  emoji       text        not null default '📦',
  rarity      text        not null check (rarity in ('common', 'rare', 'epic', 'legendary')),
  description text,
  weight      integer     not null check (weight > 0),
  sort_order  smallint    not null default 100,
  is_active   boolean     not null default true,
  created_at  timestamptz not null default now()
);

insert into public.game_items (id, name, emoji, rarity, description, weight, sort_order) values
  ('mug',         '아메리카노 머그잔',  '☕',  'common',    '책상 위 필수품',               40, 10),
  ('highlighter', '초록 형광펜',        '🖍️', 'common',    '중요한 문장에',                 40, 20),
  ('earphones',   '유선 이어폰',        '🎧', 'common',    '리스닝 연습용',                 35, 30),
  ('notebook',    '필기 노트',          '📓', 'common',    '손으로 쓰면 오래 남는다',       35, 40),
  ('brass_lamp',  '도서관 황동 스탠드', '💡', 'rare',      '뉴욕 공립도서관 그 조명',       18, 50),
  ('flag_poster', '성조기 포스터',      '🇺🇸', 'rare',      '벽에 붙이는 동기부여',          15, 60),
  ('ipad',        '아이패드와 펜슬',    '📱', 'epic',      '필기와 교재를 한 번에',          8, 70),
  ('taxi_model',  '노란 택시 모형',     '🚕', 'epic',      'Yellow Cab Rush 기념품',         6, 80),
  ('macbook',     '맥북 프로',          '💻', 'legendary', '책상의 주인공',                  3, 90)
on conflict (id) do update
  set name        = excluded.name,
      emoji       = excluded.emoji,
      rarity      = excluded.rarity,
      description = excluded.description,
      weight      = excluded.weight,
      sort_order  = excluded.sort_order;

-- ----------------------------------------------------------------------------
-- 4. game_inventory : 보유 수량 + 기숙사 배치 좌표
-- ----------------------------------------------------------------------------
create table if not exists public.game_inventory (
  user_id    uuid    not null references public.profiles (id) on delete cascade,
  item_id    text    not null references public.game_items (id) on delete cascade,
  quantity   integer not null default 1 check (quantity > 0),
  placed     boolean not null default false,
  -- 책상 위 상대 좌표(0~100%). 화면 크기가 달라져도 유지되도록 비율로 저장합니다.
  placed_x   numeric(5, 2) check (placed_x between 0 and 100),
  placed_y   numeric(5, 2) check (placed_y between 0 and 100),
  updated_at timestamptz not null default now(),
  primary key (user_id, item_id)
);

create index if not exists game_inventory_user_placed_idx
  on public.game_inventory (user_id, placed);

-- ----------------------------------------------------------------------------
-- 5. game_mistakes : 오답 기록 (Memory Boss Raid 출제 재료)
-- ----------------------------------------------------------------------------
create table if not exists public.game_mistakes (
  id             uuid        primary key default gen_random_uuid(),
  user_id        uuid        not null references public.profiles (id) on delete cascade,
  source         text        not null check (source in ('vocab', 'writing', 'speaking', 'reading', 'listening')),
  -- 문제를 식별하는 키 (어휘 게임이면 단어 자체)
  prompt         text        not null,
  correct_answer text        not null,
  last_chosen    text,
  times_wrong    integer     not null default 1 check (times_wrong >= 0),
  times_right    integer     not null default 0 check (times_right >= 0),
  -- 연속으로 정해진 횟수만큼 맞히면 졸업 처리하고 보스전 출제에서 뺍니다.
  resolved       boolean     not null default false,
  last_wrong_at  timestamptz not null default now(),
  last_right_at  timestamptz,
  created_at     timestamptz not null default now(),
  unique (user_id, source, prompt)
);

create index if not exists game_mistakes_user_unresolved_idx
  on public.game_mistakes (user_id, resolved, last_wrong_at desc);

comment on table public.game_mistakes is '틀린 문제. Memory Boss Raid 가 여기서 출제합니다.';

-- ----------------------------------------------------------------------------
-- 6. updated_at 트리거 (supabase_schema.sql 의 set_updated_at 재사용)
-- ----------------------------------------------------------------------------
drop trigger if exists game_profiles_set_updated_at on public.game_profiles;
create trigger game_profiles_set_updated_at
  before update on public.game_profiles
  for each row execute function public.set_updated_at();

drop trigger if exists game_inventory_set_updated_at on public.game_inventory;
create trigger game_inventory_set_updated_at
  before update on public.game_inventory
  for each row execute function public.set_updated_at();

-- ============================================================================
-- 7. 코인 변동 함수
--
--    game_profiles 행을 FOR UPDATE 로 잠그므로 동시에 두 요청이 들어와도
--    당일 상한 검사와 잔액 검사에 레이스가 없습니다. 잔액이 모자라면
--    INSUFFICIENT_FUNDS 예외로 전체가 롤백되어, 코인만 빠지고 보상은 없는
--    상태가 생기지 않습니다.
--
--    p_daily_cap 이 주어지면 같은 reason 의 당일(UTC) 획득 합계가 그 값을
--    넘지 않도록 지급액을 깎습니다. 깎여도 예외가 아니라 capped=true 로 알립니다.
-- ============================================================================

/** 게임 상태 행이 없으면 만들어 돌려준다. */
create or replace function public.game_ensure_profile(p_user_id uuid)
returns public.game_profiles
language plpgsql
as $$
declare
  v_row public.game_profiles;
begin
  insert into public.game_profiles (user_id) values (p_user_id)
  on conflict (user_id) do nothing;

  select * into v_row from public.game_profiles where user_id = p_user_id;
  return v_row;
end;
$$;

create or replace function public.game_apply_coins(
  p_user_id   uuid,
  p_amount    bigint,
  p_reason    text,
  p_daily_cap bigint default null,
  p_xp        bigint default 0,
  p_metadata  jsonb  default '{}'::jsonb
)
returns jsonb
language plpgsql
as $$
declare
  v_state     public.game_profiles;
  v_today_sum bigint  := 0;
  v_applied   bigint  := p_amount;
  v_capped    boolean := false;
  v_remaining bigint;
  v_balance   bigint;
begin
  if p_amount is null then
    raise exception 'ZERO_AMOUNT: 변동 금액이 없습니다.' using errcode = 'P0001';
  end if;

  insert into public.game_profiles (user_id) values (p_user_id)
  on conflict (user_id) do nothing;

  -- 이 잠금 이후의 모든 검사는 직렬화됩니다.
  select * into v_state from public.game_profiles where user_id = p_user_id for update;

  -- 일일 상한 (획득에만 적용)
  if p_amount > 0 and p_daily_cap is not null then
    select coalesce(sum(amount), 0) into v_today_sum
      from public.game_coin_ledger
     where user_id = p_user_id
       and reason = p_reason
       and amount > 0
       and created_at >= date_trunc('day', now());

    v_remaining := greatest(p_daily_cap - v_today_sum, 0);
    if p_amount > v_remaining then
      v_applied := v_remaining;
      v_capped  := true;
    end if;
  end if;

  if p_amount < 0 and v_state.coin_balance + p_amount < 0 then
    raise exception 'INSUFFICIENT_FUNDS: 코인이 부족합니다. (잔액 %, 필요 %)',
      v_state.coin_balance, abs(p_amount) using errcode = 'P0001';
  end if;

  v_balance := v_state.coin_balance + v_applied;

  -- 상한에 걸려 0이 되면 원장에 0원 줄을 남기지 않습니다 (amount <> 0 제약).
  if v_applied <> 0 then
    insert into public.game_coin_ledger (user_id, amount, reason, balance_after, metadata)
    values (p_user_id, v_applied, p_reason, v_balance, coalesce(p_metadata, '{}'::jsonb));
  end if;

  update public.game_profiles
     set coin_balance = v_balance,
         total_earned = total_earned + greatest(v_applied, 0),
         total_spent  = total_spent + greatest(-v_applied, 0),
         xp           = xp + greatest(coalesce(p_xp, 0), 0)
   where user_id = p_user_id
   returning * into v_state;

  return jsonb_build_object(
    'applied',       v_applied,
    'requested',     p_amount,
    'capped',        v_capped,
    'cap_remaining', case
                       when p_daily_cap is null then null
                       else greatest(p_daily_cap - v_today_sum - greatest(v_applied, 0), 0)
                     end,
    'state',         to_jsonb(v_state)
  );
end;
$$;

comment on function public.game_apply_coins(uuid, bigint, text, bigint, bigint, jsonb) is
  '코인 변동을 원장 기록·상한 검사와 함께 원자적으로 반영한다 (service_role 전용)';

-- ----------------------------------------------------------------------------
-- 8. 가챠 : 차감 + 가중치 추첨 + 적립을 한 트랜잭션으로
--
--    추첨을 DB 안에서 하므로 확률표(weight)가 백엔드 코드나 네트워크로
--    나가지 않습니다. p_count 로 다연차도 한 번에 처리합니다.
-- ----------------------------------------------------------------------------
create or replace function public.game_draw_gacha(
  p_user_id uuid,
  p_cost    bigint,
  p_count   integer default 1
)
returns jsonb
language plpgsql
as $$
declare
  v_result jsonb;
  v_total  integer;
  v_roll   integer;
  -- game_items 행 타입을 그대로 쓰면 안 됩니다. 아래 추첨 서브쿼리가
  -- cumulative 컬럼을 하나 더 붙이기 때문에 컬럼 수가 맞지 않아 실패합니다.
  v_id     text;
  v_name   text;
  v_emoji  text;
  v_rarity text;
  v_qty    integer;
  v_drawn  jsonb := '[]'::jsonb;
  i        integer;
begin
  if p_cost is null or p_cost <= 0 then
    raise exception 'INVALID_COST: 가챠 비용이 올바르지 않습니다.' using errcode = 'P0001';
  end if;
  if p_count is null or p_count < 1 or p_count > 10 then
    raise exception 'INVALID_COUNT: 뽑기 횟수는 1~10 입니다.' using errcode = 'P0001';
  end if;

  select sum(weight) into v_total from public.game_items where is_active;
  if v_total is null or v_total <= 0 then
    raise exception 'EMPTY_CATALOG: 가챠 카탈로그가 비어 있습니다.' using errcode = 'P0001';
  end if;

  -- 먼저 전액 차감합니다. 잔액이 모자라면 여기서 예외가 나고 지급은 없습니다.
  v_result := public.game_apply_coins(
    p_user_id, -(p_cost * p_count), 'gacha_draw', null, 0,
    jsonb_build_object('count', p_count)
  );

  for i in 1..p_count loop
    v_roll := floor(random() * v_total)::int;

    -- 필요한 컬럼만 꺼냅니다 (서브쿼리에 cumulative 가 더 붙어 있으므로).
    select c.id, c.name, c.emoji, c.rarity
      into v_id, v_name, v_emoji, v_rarity
      from (
        select g.id, g.name, g.emoji, g.rarity,
               sum(g.weight) over (order by g.id) as cumulative
          from public.game_items g
         where g.is_active
      ) c
     where c.cumulative > v_roll
     order by c.cumulative
     limit 1;

    insert into public.game_inventory as inv (user_id, item_id, quantity)
    values (p_user_id, v_id, 1)
    on conflict (user_id, item_id) do update
      set quantity = inv.quantity + 1,
          updated_at = now()
    returning inv.quantity into v_qty;

    v_drawn := v_drawn || jsonb_build_object(
      'id', v_id, 'name', v_name, 'emoji', v_emoji,
      'rarity', v_rarity, 'quantity', v_qty
    );
  end loop;

  return v_result || jsonb_build_object('items', v_drawn, 'cost', p_cost * p_count);
end;
$$;

comment on function public.game_draw_gacha(uuid, bigint, integer) is
  '가챠 차감·추첨·적립을 원자적으로 처리한다 (service_role 전용)';

-- ----------------------------------------------------------------------------
-- 9. 활동 기록 : xp 증가 + 연속 학습일 갱신 + 티어 캐시 저장
--
--    streak 은 DB 타임존(UTC) 날짜 기준입니다. 어제 활동이 있으면 +1,
--    오늘 이미 했으면 그대로, 그보다 오래됐으면 1로 리셋합니다.
--    p_tier_level 은 main.py 가 계산한 값의 캐시입니다.
-- ----------------------------------------------------------------------------
create or replace function public.game_touch_activity(
  p_user_id    uuid,
  p_xp         bigint   default 0,
  p_tier_level smallint default null
)
returns public.game_profiles
language plpgsql
as $$
declare
  v_state public.game_profiles;
  v_today date := (now() at time zone 'utc')::date;
  v_streak integer;
begin
  insert into public.game_profiles (user_id) values (p_user_id)
  on conflict (user_id) do nothing;

  select * into v_state from public.game_profiles where user_id = p_user_id for update;

  if v_state.last_active_date is null then
    v_streak := 1;
  elsif v_state.last_active_date = v_today then
    v_streak := greatest(v_state.streak_days, 1);
  elsif v_state.last_active_date = v_today - 1 then
    v_streak := v_state.streak_days + 1;
  else
    v_streak := 1;
  end if;

  update public.game_profiles
     set xp               = xp + greatest(coalesce(p_xp, 0), 0),
         streak_days      = v_streak,
         best_streak_days = greatest(best_streak_days, v_streak),
         last_active_date = v_today,
         tier_level       = coalesce(p_tier_level, tier_level)
   where user_id = p_user_id
   returning * into v_state;

  return v_state;
end;
$$;

-- ----------------------------------------------------------------------------
-- 10. 잔액 검증/복구 : 캐시가 원장과 어긋났는지 확인하고 맞춘다
-- ----------------------------------------------------------------------------
create or replace function public.game_recompute_balance(p_user_id uuid)
returns jsonb
language plpgsql
as $$
declare
  v_ledger  bigint;
  v_earned  bigint;
  v_spent   bigint;
  v_cached  bigint;
begin
  select coalesce(sum(amount), 0),
         coalesce(sum(amount) filter (where amount > 0), 0),
         coalesce(sum(-amount) filter (where amount < 0), 0)
    into v_ledger, v_earned, v_spent
    from public.game_coin_ledger
   where user_id = p_user_id;

  select coin_balance into v_cached
    from public.game_profiles where user_id = p_user_id for update;

  update public.game_profiles
     set coin_balance = greatest(v_ledger, 0),
         total_earned = v_earned,
         total_spent  = v_spent
   where user_id = p_user_id;

  return jsonb_build_object(
    'cached_balance', v_cached,
    'ledger_balance', v_ledger,
    'drift',          coalesce(v_cached, 0) - v_ledger,
    'repaired',       coalesce(v_cached, 0) <> v_ledger
  );
end;
$$;

-- ----------------------------------------------------------------------------
-- 11. 함수 실행 권한 : service_role 만
-- ----------------------------------------------------------------------------
revoke all on function public.game_ensure_profile(uuid) from public;
revoke all on function public.game_apply_coins(uuid, bigint, text, bigint, bigint, jsonb) from public;
revoke all on function public.game_draw_gacha(uuid, bigint, integer) from public;
revoke all on function public.game_touch_activity(uuid, bigint, smallint) from public;
revoke all on function public.game_recompute_balance(uuid) from public;

-- anon / authenticated / service_role 은 Supabase 에만 있는 역할입니다.
-- 로컬 Postgres 에서 그대로 돌려도 깨지지 않도록 존재할 때만 실행합니다.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on function public.game_ensure_profile(uuid) from anon, authenticated';
    execute 'revoke all on function public.game_apply_coins(uuid, bigint, text, bigint, bigint, jsonb) from anon, authenticated';
    execute 'revoke all on function public.game_draw_gacha(uuid, bigint, integer) from anon, authenticated';
    execute 'revoke all on function public.game_touch_activity(uuid, bigint, smallint) from anon, authenticated';
    execute 'revoke all on function public.game_recompute_balance(uuid) from anon, authenticated';
  end if;

  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant execute on function public.game_ensure_profile(uuid) to service_role';
    execute 'grant execute on function public.game_apply_coins(uuid, bigint, text, bigint, bigint, jsonb) to service_role';
    execute 'grant execute on function public.game_draw_gacha(uuid, bigint, integer) to service_role';
    execute 'grant execute on function public.game_touch_activity(uuid, bigint, smallint) to service_role';
    execute 'grant execute on function public.game_recompute_balance(uuid) to service_role';
  end if;
end
$$;

-- ----------------------------------------------------------------------------
-- 12. 주간 랭킹 뷰
-- ----------------------------------------------------------------------------
create or replace view public.game_weekly_leaderboard
with (security_invoker = on) as
select
  l.user_id,
  coalesce(p.full_name, split_part(coalesce(p.email, ''), '@', 1), '익명 유학생') as display_name,
  sum(l.amount) filter (where l.amount > 0) as earned_this_week,
  count(*) filter (where l.amount > 0)      as events_this_week,
  max(l.created_at)                         as last_earned_at
from public.game_coin_ledger l
left join public.profiles p on p.id = l.user_id
where l.created_at >= date_trunc('week', now())
group by l.user_id, p.full_name, p.email;

comment on view public.game_weekly_leaderboard is '이번 주(월요일 기준) 획득 코인 순위';

-- ----------------------------------------------------------------------------
-- 13. RLS : 본인 데이터만 "읽기". 쓰기는 전부 백엔드(service_role).
-- ----------------------------------------------------------------------------
alter table public.game_profiles    enable row level security;
alter table public.game_coin_ledger enable row level security;
alter table public.game_inventory   enable row level security;
alter table public.game_mistakes    enable row level security;
alter table public.game_items       enable row level security;

drop policy if exists "본인 게임 상태 조회" on public.game_profiles;
create policy "본인 게임 상태 조회" on public.game_profiles
  for select using (auth.uid() = user_id);

drop policy if exists "본인 원장 조회" on public.game_coin_ledger;
create policy "본인 원장 조회" on public.game_coin_ledger
  for select using (auth.uid() = user_id);

drop policy if exists "본인 인벤토리 조회" on public.game_inventory;
create policy "본인 인벤토리 조회" on public.game_inventory
  for select using (auth.uid() = user_id);

drop policy if exists "본인 오답 조회" on public.game_mistakes;
create policy "본인 오답 조회" on public.game_mistakes
  for select using (auth.uid() = user_id);

-- game_items 에는 select 정책을 두지 않습니다. weight(확률)가 들어 있어
-- 클라이언트가 직접 읽으면 안 되고, 백엔드만 service_role 로 접근합니다.

-- ----------------------------------------------------------------------------
-- 14. 기본 권한 회수 (RLS 정책만으로는 부족합니다)
--
--     Supabase 는 public 스키마의 새 테이블에 anon/authenticated 까지
--     INSERT·UPDATE·DELETE 권한을 기본으로 줍니다. 정책이 없으면 지금은
--     막히지만, 나중에 누군가 정책을 하나 추가하는 순간 쓰기가 열립니다.
-- ----------------------------------------------------------------------------
do $$
declare
  t text;
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    return;
  end if;

  foreach t in array array[
    'game_profiles', 'game_coin_ledger', 'game_items', 'game_inventory', 'game_mistakes'
  ] loop
    execute format('revoke insert, update, delete, truncate on public.%I from anon, authenticated', t);
  end loop;

  -- 확률표는 읽기도 막습니다.
  execute 'revoke select on public.game_items from anon, authenticated';
end
$$;
