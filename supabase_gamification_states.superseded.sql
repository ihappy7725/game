-- ============================================================================
-- TOEFL High-Score Helper - 게임화(미국 정복) 스키마 (DDL)
-- supabase_schema.sql 을 먼저 실행한 뒤, 이 파일 전체를 SQL Editor 에 붙여넣고
-- 실행하세요. 반복 실행해도 안전하도록 작성되어 있습니다 (idempotent).
--
-- 설계 원칙 - 코인은 "돈처럼" 다룬다
--   1) 잔액(game_states.coin_balance)은 절대 클라이언트가 덮어쓰지 못한다.
--      모든 변동은 coin_ledger 에 한 줄씩 남고, 잔액 갱신과 원장 기록은
--      아래 apply_coin_change() / pull_gacha() 함수 안에서 같은 트랜잭션으로
--      처리된다. 중간에 실패하면 둘 다 롤백된다.
--   2) 그 함수들은 service_role 에게만 EXECUTE 를 준다. 프론트엔드(anon /
--      authenticated 키)가 직접 호출해 금액을 지정할 수 없어야 하기 때문이다.
--   3) 게임화 테이블은 anon / authenticated 에게 SELECT 만 허용한다.
--      쓰기는 전부 백엔드(service_role)를 통한다. Supabase 의 기본 권한은
--      public 스키마의 새 테이블에 INSERT/UPDATE/DELETE 까지 주기 때문에,
--      RLS 정책만 믿지 않고 아래에서 명시적으로 REVOKE 한다.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. game_states : 사용자별 게임 상태 (메뉴바가 읽는 값)
--
--    tier_level 은 "캐시"다. 실제 승급 기준은 main.py 의 TIER_THRESHOLDS 에
--    한 곳으로 모아 두었고, 백엔드가 상태를 읽을 때마다 xp 로 다시 계산해
--    값이 달라지면 이 컬럼에 써 준다. 여기에 기준을 또 적으면 두 곳이
--    어긋나므로 SQL 에서는 티어를 계산하지 않는다.
-- ----------------------------------------------------------------------------
create table if not exists public.game_states (
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

comment on table public.game_states is '사용자별 코인 잔액·티어·연속 학습일 (쓰기는 백엔드 전용)';
comment on column public.game_states.coin_balance is 'coin_ledger 합계와 일치해야 하는 캐시 잔액. recompute_coin_balance() 로 검증/복구';
comment on column public.game_states.tier_level is 'main.py TIER_THRESHOLDS 가 xp 로 계산한 티어의 캐시값 (1부터 시작)';
comment on column public.game_states.last_active_date is 'streak 판정 기준일 (DB 타임존 = UTC)';

drop trigger if exists game_states_set_updated_at on public.game_states;
create trigger game_states_set_updated_at
  before update on public.game_states
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 2. coin_ledger : 코인 변동 원장 (획득 = 양수, 소비 = 음수)
--
--    reason 의 허용값은 main.py 의 COIN_RULES / SERVER_ONLY_REASONS 와
--    반드시 동일하게 유지해야 한다. 어긋나면 insert 가 거부되어 백엔드가
--    502 를 돌려주므로 조용히 틀리는 일은 없다.
-- ----------------------------------------------------------------------------
create table if not exists public.coin_ledger (
  id            bigint      generated always as identity primary key,
  user_id       uuid        not null references public.profiles (id) on delete cascade,
  amount        bigint      not null check (amount <> 0),
  reason        text        not null check (reason in (
                              -- 획득
                              'writing_submission',   -- 라이팅 채점 완료
                              'speaking_submission',  -- 스피킹 채점 완료
                              'daily_login',          -- 하루 첫 접속
                              'streak_bonus',         -- 연속 학습일 보너스 (서버 전용)
                              'mistake_cleared',      -- 오답 재도전 성공
                              'game_clear',           -- 아케이드 게임 클리어
                              'boss_damage',          -- Memory Boss Raid 피해량 보상
                              'tier_up',              -- 티어 승급 축하금 (서버 전용)
                              'bet_win',              -- 월스트리트 배팅 성공 (서버 전용)
                              'admin_grant',          -- 운영 보정 (서버 전용)
                              -- 소비
                              'gacha_pull',           -- 가챠 뽑기 (서버 전용)
                              'bet_stake',            -- 배팅 금액 차감
                              'bet_forfeit',          -- 배팅 실패 몰수 (서버 전용)
                              'dorm_reroll',          -- 기숙사 배치 초기화
                              'admin_revoke'          -- 운영 보정 (서버 전용)
                            )),
  balance_after bigint      not null check (balance_after >= 0),
  metadata      jsonb       not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);

comment on table public.coin_ledger is '코인 획득·소비 내역. 잔액의 근거이며 배팅 몰수·가챠 소비 추적용';
comment on column public.coin_ledger.amount is '양수=획득, 음수=소비. 0은 기록하지 않는다';
comment on column public.coin_ledger.balance_after is '이 줄을 반영한 직후의 잔액 (원장만 보고도 감사 가능하도록)';
comment on column public.coin_ledger.metadata is 'submission_id, item_code, bet_id 등 변동의 출처';

create index if not exists coin_ledger_user_created_idx
  on public.coin_ledger (user_id, created_at desc);
-- 사유별 "당일 획득 상한" 집계용 (apply_coin_change 가 매번 쓴다)
create index if not exists coin_ledger_user_reason_created_idx
  on public.coin_ledger (user_id, reason, created_at desc);

-- ----------------------------------------------------------------------------
-- 3. gacha_items : 가챠 아이템 카탈로그
--
--    뽑기 확률은 여기에 두지 않는다. 확률 테이블은 main.py 의 GACHA_TABLE
--    에만 있고, 클라이언트가 읽을 수 있는 카탈로그에는 rarity 등급까지만
--    노출한다.
-- ----------------------------------------------------------------------------
create table if not exists public.gacha_items (
  code        text        primary key,
  name        text        not null,
  emoji       text        not null default '',
  rarity      text        not null check (rarity in ('common', 'rare', 'epic', 'legendary')),
  description text,
  sort_order  smallint    not null default 100,
  is_active   boolean     not null default true,
  created_at  timestamptz not null default now()
);

comment on table public.gacha_items is '뉴욕 기숙사 꾸미기 오브젝트 카탈로그 (확률은 서버 코드에만 있음)';

-- 시드 데이터: 반복 실행 시 이름/등급만 갱신한다
-- (is_active 는 운영 중 바꿀 수 있으므로 덮어쓰지 않는다)
insert into public.gacha_items (code, name, emoji, rarity, description, sort_order) values
  ('mug',             '머그잔',         '☕',  'common',    '식어버린 커피가 담긴 기숙사 필수품',   10),
  ('highlighter',     '형광펜',         '🖍',  'common',    '리딩 지문을 노랗게 물들이는 3색 세트', 20),
  ('wired_earphones', '유선 이어폰',    '🎧',  'common',    '배터리 걱정 없는 리스닝 파트너',       30),
  ('brass_lamp',      '황동 스탠드',    '💡',  'rare',      '밤샘 공부의 따뜻한 조명',              40),
  ('flag_poster',     '성조기 포스터',  '🇺🇸',  'rare',      '벽에 붙여 두는 유학 동기부여',         50),
  ('ipad',            '아이패드',       '📱',  'epic',      '필기와 단어장을 한 번에',              60),
  ('macbook',         '맥북',           '💻',  'epic',      '에세이 타이핑 속도가 올라가는 기분',   70),
  ('yellow_taxi',     '노란 택시 모형', '🚕',  'legendary', '맨해튼 한가운데를 책상에 올려놓기',    80)
on conflict (code) do update set
  name        = excluded.name,
  emoji       = excluded.emoji,
  rarity      = excluded.rarity,
  description = excluded.description,
  sort_order  = excluded.sort_order;

-- ----------------------------------------------------------------------------
-- 4. user_inventory : 보유 수량 + 기숙사 배치 좌표
--
--    pos_x / pos_y 는 0~1 정규화 좌표다. 책상 위젯의 픽셀 크기가 바뀌어도
--    배치가 깨지지 않도록 비율로 저장한다.
-- ----------------------------------------------------------------------------
create table if not exists public.user_inventory (
  user_id      uuid          not null references public.profiles (id) on delete cascade,
  item_code    text          not null references public.gacha_items (code) on delete cascade,
  quantity     integer       not null default 0 check (quantity >= 0),
  is_placed    boolean       not null default false,
  pos_x        numeric(5, 4) check (pos_x between 0 and 1),
  pos_y        numeric(5, 4) check (pos_y between 0 and 1),
  z_index      smallint      not null default 0 check (z_index between 0 and 99),
  first_got_at timestamptz   not null default now(),
  updated_at   timestamptz   not null default now(),
  primary key (user_id, item_code),
  -- 배치된 아이템은 좌표가 반드시 있어야 한다
  constraint user_inventory_placed_needs_coords
    check (not is_placed or (pos_x is not null and pos_y is not null))
);

comment on table public.user_inventory is '가챠로 획득한 오브젝트의 보유 수량과 기숙사 배치 상태';
comment on column public.user_inventory.pos_x is '책상 위 가로 위치 (0~1 정규화)';
comment on column public.user_inventory.pos_y is '책상 위 세로 위치 (0~1 정규화)';

create index if not exists user_inventory_user_placed_idx
  on public.user_inventory (user_id, is_placed);

drop trigger if exists user_inventory_set_updated_at on public.user_inventory;
create trigger user_inventory_set_updated_at
  before update on public.user_inventory
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 5. mistake_records : 오답 기록 (Memory Boss Raid 가 여기서 문제를 꺼낸다)
--
--    question_key 는 "같은 문제"를 식별하는 키다. 문제 은행이 아직 없으므로
--    백엔드가 문제 지문을 정규화해 해시한 값을 쓴다. 같은 문제를 또 틀리면
--    새 행이 아니라 기존 행의 mistake_count 가 올라간다.
-- ----------------------------------------------------------------------------
create table if not exists public.mistake_records (
  id              uuid        primary key default gen_random_uuid(),
  user_id         uuid        not null references public.profiles (id) on delete cascade,
  submission_id   uuid        references public.submissions (id) on delete set null,
  section         text        not null
                              check (section in ('writing', 'speaking', 'reading', 'listening', 'vocabulary')),
  question_key    text        not null,
  question_prompt text,
  user_answer     text,
  correct_answer  text,
  explanation     text,
  mistake_count   integer     not null default 1 check (mistake_count >= 1),
  retry_count     integer     not null default 0 check (retry_count >= 0),
  last_wrong_at   timestamptz not null default now(),
  last_correct_at timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (user_id, question_key)
);

comment on table public.mistake_records is '틀린 문제와 재도전 이력. 보스 레이드 문제 풀의 원천';
comment on column public.mistake_records.question_key is '같은 문제를 식별하는 키 (백엔드가 지문을 정규화해 해시)';
comment on column public.mistake_records.last_correct_at is 'null 이면 아직 극복하지 못한 오답 (= 보스 레이드 대상)';

-- 보스 레이드용: 아직 못 맞힌 오답을 최근 순으로 꺼낸다
create index if not exists mistake_records_user_unresolved_idx
  on public.mistake_records (user_id, last_wrong_at desc)
  where last_correct_at is null;

drop trigger if exists mistake_records_set_updated_at on public.mistake_records;
create trigger mistake_records_set_updated_at
  before update on public.mistake_records
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 6. 코인 변동 함수 : 잔액 갱신 + 원장 기록을 한 트랜잭션으로 처리
--
--    - game_states 행을 FOR UPDATE 로 잠그므로, 동시에 두 요청이 들어와도
--      당일 상한 검사와 잔액 검사가 레이스 없이 처리된다.
--    - 잔액이 부족하면 INSUFFICIENT_FUNDS 예외를 던지고 전체가 롤백된다.
--      (코인이 "사라진 채" 결과만 주어지는 일이 없다)
--    - p_daily_cap 이 주어지면 같은 reason 의 당일(UTC) 획득 합계가 그 값을
--      넘지 않도록 지급액을 깎는다. 깎인 경우에도 예외가 아니라
--      applied=0 / capped=true 로 알려준다.
-- ----------------------------------------------------------------------------
create or replace function public.apply_coin_change(
  p_user_id    uuid,
  p_amount     bigint,
  p_reason     text,
  p_daily_cap  bigint default null,
  p_xp         bigint default 0,
  p_metadata   jsonb  default '{}'::jsonb
)
returns jsonb
language plpgsql
as $$
declare
  v_state     public.game_states;
  v_today_sum bigint  := 0;
  v_applied   bigint  := p_amount;
  v_capped    boolean := false;
  v_remaining bigint;
  v_balance   bigint;
begin
  if p_amount is null or p_amount = 0 then
    raise exception 'ZERO_AMOUNT: 변동 금액이 0입니다.' using errcode = 'P0001';
  end if;

  -- 상태 행이 없으면 만든다 (프로필이 없으면 FK 위반으로 거부된다)
  insert into public.game_states (user_id) values (p_user_id)
  on conflict (user_id) do nothing;

  select * into v_state
  from public.game_states
  where user_id = p_user_id
  for update;

  if p_amount > 0 and p_daily_cap is not null then
    select coalesce(sum(amount), 0) into v_today_sum
    from public.coin_ledger
    where user_id = p_user_id
      and reason  = p_reason
      and amount  > 0
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

  -- 상한에 걸려 0이 되었으면 원장에 0원 줄을 남기지 않는다 (amount <> 0 제약)
  if v_applied <> 0 then
    insert into public.coin_ledger (user_id, amount, reason, balance_after, metadata)
    values (p_user_id, v_applied, p_reason, v_balance, coalesce(p_metadata, '{}'::jsonb));
  end if;

  update public.game_states
  set coin_balance = v_balance,
      total_earned = total_earned + greatest(v_applied, 0),
      total_spent  = total_spent  + greatest(-v_applied, 0),
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

comment on function public.apply_coin_change(uuid, bigint, text, bigint, bigint, jsonb) is
  '코인 획득/소비를 원장 기록과 함께 원자적으로 반영한다 (service_role 전용)';

-- ----------------------------------------------------------------------------
-- 7. 가챠 함수 : 차감 + 인벤토리 지급을 한 트랜잭션으로 처리
--
--    확률 계산은 백엔드가 끝낸 뒤, 그 결과(p_items)와 총 비용(p_total_cost)을
--    한 번에 넘긴다. 잔액이 부족하면 아무것도 지급되지 않고, 지급 중 오류가
--    나면 차감도 함께 롤백된다.
--    p_items 형태: [{"code": "mug", "qty": 1}, {"code": "macbook", "qty": 2}]
-- ----------------------------------------------------------------------------
create or replace function public.pull_gacha(
  p_user_id    uuid,
  p_total_cost bigint,
  p_items      jsonb,
  p_metadata   jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
as $$
declare
  v_item   jsonb;
  v_code   text;
  v_qty    integer;
  v_result jsonb;
begin
  if p_total_cost is null or p_total_cost <= 0 then
    raise exception 'INVALID_COST: 가챠 비용이 올바르지 않습니다.' using errcode = 'P0001';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'INVALID_ITEMS: 지급할 아이템이 없습니다.' using errcode = 'P0001';
  end if;

  -- 먼저 차감한다. 잔액이 부족하면 여기서 예외가 나고 지급은 일어나지 않는다.
  v_result := public.apply_coin_change(
    p_user_id, -p_total_cost, 'gacha_pull', null, 0,
    coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('items', p_items)
  );

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_code := v_item ->> 'code';
    v_qty  := coalesce((v_item ->> 'qty')::integer, 1);
    if v_qty <= 0 then
      raise exception 'INVALID_ITEMS: 수량이 올바르지 않습니다.' using errcode = 'P0001';
    end if;

    -- 카탈로그에 없는 코드는 FK 위반으로 거부되고 차감까지 롤백된다
    insert into public.user_inventory as inv (user_id, item_code, quantity)
    values (p_user_id, v_code, v_qty)
    on conflict (user_id, item_code) do update
      set quantity = inv.quantity + excluded.quantity;
  end loop;

  return v_result;
end;
$$;

comment on function public.pull_gacha(uuid, bigint, jsonb, jsonb) is
  '가챠 결과 지급과 코인 차감을 원자적으로 처리한다 (service_role 전용)';

-- ----------------------------------------------------------------------------
-- 8. 활동 기록 함수 : xp 증가 + 연속 학습일(streak) 갱신 + 티어 캐시 저장
--
--    streak 판정은 DB 타임존(UTC) 기준 날짜로 한다. 어제 활동이 있으면 +1,
--    오늘 이미 활동했으면 그대로, 그보다 오래됐으면 1로 리셋한다.
--    p_tier_level 은 백엔드(main.py TIER_THRESHOLDS)가 계산한 값의 캐시다.
-- ----------------------------------------------------------------------------
create or replace function public.touch_activity(
  p_user_id    uuid,
  p_xp         bigint   default 0,
  p_tier_level smallint default null
)
returns jsonb
language plpgsql
as $$
declare
  v_state  public.game_states;
  v_streak integer;
begin
  insert into public.game_states (user_id) values (p_user_id)
  on conflict (user_id) do nothing;

  select * into v_state
  from public.game_states
  where user_id = p_user_id
  for update;

  if v_state.last_active_date is null then
    v_streak := 1;
  elsif v_state.last_active_date = current_date then
    v_streak := greatest(v_state.streak_days, 1);
  elsif v_state.last_active_date = current_date - 1 then
    v_streak := v_state.streak_days + 1;
  else
    v_streak := 1;  -- 하루 이상 비었으면 처음부터
  end if;

  update public.game_states
  set xp               = xp + greatest(coalesce(p_xp, 0), 0),
      streak_days      = v_streak,
      best_streak_days = greatest(best_streak_days, v_streak),
      last_active_date = current_date,
      tier_level       = coalesce(p_tier_level, tier_level)
  where user_id = p_user_id
  returning * into v_state;

  return to_jsonb(v_state);
end;
$$;

comment on function public.touch_activity(uuid, bigint, smallint) is
  'xp·연속 학습일·티어 캐시를 갱신한다 (service_role 전용)';

-- ----------------------------------------------------------------------------
-- 9. 잔액 검증/복구 함수
--    캐시 잔액(coin_balance)과 원장 합계가 어긋났는지 확인하고 맞춰 준다.
--    운영 중 이상이 의심될 때 수동으로 호출한다.
-- ----------------------------------------------------------------------------
create or replace function public.recompute_coin_balance(p_user_id uuid)
returns jsonb
language plpgsql
as $$
declare
  v_ledger bigint;
  v_earned bigint;
  v_spent  bigint;
  v_before bigint;
begin
  select coalesce(sum(amount), 0),
         coalesce(sum(greatest(amount, 0)), 0),
         coalesce(sum(greatest(-amount, 0)), 0)
    into v_ledger, v_earned, v_spent
  from public.coin_ledger
  where user_id = p_user_id;

  select coin_balance into v_before
  from public.game_states
  where user_id = p_user_id
  for update;

  update public.game_states
  set coin_balance = greatest(v_ledger, 0),
      total_earned = v_earned,
      total_spent  = v_spent
  where user_id = p_user_id;

  return jsonb_build_object(
    'previous_balance', v_before,
    'ledger_balance',   v_ledger,
    'drift',            coalesce(v_before, 0) - v_ledger
  );
end;
$$;

comment on function public.recompute_coin_balance(uuid) is
  '원장 합계로 캐시 잔액을 재계산한다 (감사·복구용, service_role 전용)';

-- ----------------------------------------------------------------------------
-- 10. 함수 실행 권한 : service_role 만
--     Postgres 는 create function 시 PUBLIC 에 EXECUTE 를 주므로, 명시적으로
--     회수해야 한다. 이게 빠지면 프론트엔드가 anon 키로
--     rpc('apply_coin_change', {p_amount: 999999}) 를 호출해 코인을 무한히
--     만들 수 있다.
-- ----------------------------------------------------------------------------
revoke all on function public.apply_coin_change(uuid, bigint, text, bigint, bigint, jsonb) from public;
revoke all on function public.pull_gacha(uuid, bigint, jsonb, jsonb)                        from public;
revoke all on function public.touch_activity(uuid, bigint, smallint)                        from public;
revoke all on function public.recompute_coin_balance(uuid)                                  from public;

do $$
begin
  -- anon / authenticated 롤은 Supabase 프로젝트에만 존재한다 (로컬 psql 대비)
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on function public.apply_coin_change(uuid, bigint, text, bigint, bigint, jsonb) from anon, authenticated';
    execute 'revoke all on function public.pull_gacha(uuid, bigint, jsonb, jsonb) from anon, authenticated';
    execute 'revoke all on function public.touch_activity(uuid, bigint, smallint) from anon, authenticated';
    execute 'revoke all on function public.recompute_coin_balance(uuid) from anon, authenticated';
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant execute on function public.apply_coin_change(uuid, bigint, text, bigint, bigint, jsonb) to service_role';
    execute 'grant execute on function public.pull_gacha(uuid, bigint, jsonb, jsonb) to service_role';
    execute 'grant execute on function public.touch_activity(uuid, bigint, smallint) to service_role';
    execute 'grant execute on function public.recompute_coin_balance(uuid) to service_role';
  end if;
end;
$$;

-- ----------------------------------------------------------------------------
-- 11. RLS : 본인 데이터만 "읽기". 쓰기는 백엔드(service_role)만.
--     service_role 키는 RLS 를 우회하므로 아래 정책의 영향을 받지 않는다.
-- ----------------------------------------------------------------------------
alter table public.game_states     enable row level security;
alter table public.coin_ledger     enable row level security;
alter table public.gacha_items     enable row level security;
alter table public.user_inventory  enable row level security;
alter table public.mistake_records enable row level security;

drop policy if exists "본인 게임 상태 조회" on public.game_states;
create policy "본인 게임 상태 조회" on public.game_states
  for select using (auth.uid() = user_id);

drop policy if exists "본인 코인 원장 조회" on public.coin_ledger;
create policy "본인 코인 원장 조회" on public.coin_ledger
  for select using (auth.uid() = user_id);

-- 카탈로그는 공개 정보 (확률은 들어 있지 않다)
drop policy if exists "가챠 카탈로그 조회" on public.gacha_items;
create policy "가챠 카탈로그 조회" on public.gacha_items
  for select using (true);

drop policy if exists "본인 인벤토리 조회" on public.user_inventory;
create policy "본인 인벤토리 조회" on public.user_inventory
  for select using (auth.uid() = user_id);

drop policy if exists "본인 오답 기록 조회" on public.mistake_records;
create policy "본인 오답 기록 조회" on public.mistake_records
  for select using (auth.uid() = user_id);

-- 정책을 추가하는 것만으로는 부족하다: Supabase 의 기본 권한이 public 스키마의
-- 새 테이블에 INSERT/UPDATE/DELETE 까지 주기 때문에, 정책이 하나라도 잘못
-- 추가되면 바로 쓰기가 열린다. 테이블 수준에서 아예 회수해 둔다.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke insert, update, delete, truncate on public.game_states     from anon, authenticated';
    execute 'revoke insert, update, delete, truncate on public.coin_ledger     from anon, authenticated';
    execute 'revoke insert, update, delete, truncate on public.gacha_items     from anon, authenticated';
    execute 'revoke insert, update, delete, truncate on public.user_inventory  from anon, authenticated';
    execute 'revoke insert, update, delete, truncate on public.mistake_records from anon, authenticated';
  end if;
end;
$$;

-- ----------------------------------------------------------------------------
-- 12. weekly_leaderboard : 주간 리더보드 집계 뷰
--     submission_stats 와 같이 security_invoker = on 이다. 즉 anon /
--     authenticated 키로 직접 조회하면 RLS 때문에 "본인 행"만 보인다.
--     남의 순위까지 보여 주는 것은 백엔드(service_role)의
--     GET /api/game/leaderboard 뿐이고, 거기서 노출 항목을 통제한다.
--
--     display_name 에 이메일은 절대 넣지 않는다. 리더보드는 다른 사용자에게
--     보이는 화면이므로 이메일이 들어가면 그대로 개인정보 유출이다.
--     주 시작은 date_trunc('week', now()) = 월요일 00:00 UTC (Supabase 기본 UTC).
-- ----------------------------------------------------------------------------
create or replace view public.weekly_leaderboard
with (security_invoker = on) as
with bounds as (
  select date_trunc('week', now()) as week_start_at
),
earned as (
  select l.user_id, sum(l.amount) as coins_earned
  from public.coin_ledger l, bounds b
  where l.amount > 0
    and l.created_at >= b.week_start_at
  group by l.user_id
),
studied as (
  select s.user_id,
         count(*)                         as attempts,
         round(avg(s.estimated_score), 1)  as avg_score
  from public.submissions s, bounds b
  where s.user_id is not null
    and s.created_at >= b.week_start_at
  group by s.user_id
)
select
  p.id                                                                       as user_id,
  coalesce(nullif(trim(p.full_name), ''), 'Student ' || left(p.id::text, 4)) as display_name,
  coalesce(g.tier_level, 1)                                                  as tier_level,
  coalesce(g.streak_days, 0)                                                 as streak_days,
  coalesce(e.coins_earned, 0)                                                as coins_earned,
  coalesce(st.attempts, 0)                                                   as attempts,
  st.avg_score                                                               as avg_score,
  b.week_start_at                                                            as week_start_at,
  rank() over (
    order by coalesce(e.coins_earned, 0) desc,
             coalesce(st.attempts, 0)    desc,
             p.id
  )                                                                          as rank
from public.profiles p
cross join bounds b
left join public.game_states g  on g.user_id  = p.id
left join earned             e  on e.user_id  = p.id
left join studied            st on st.user_id = p.id
-- 이번 주에 아무 활동이 없는 사용자는 순위에서 뺀다 (0점 행으로 리스트가 길어짐)
where coalesce(e.coins_earned, 0) > 0
   or coalesce(st.attempts, 0)    > 0;

comment on view public.weekly_leaderboard is '이번 주(월요일 UTC 기준) 획득 코인 순위. 이메일은 노출하지 않는다';
