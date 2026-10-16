-- ===== STEP 1 / 2 : 테이블 · 인덱스 · 트리거 =====
-- Supabase SQL Editor 에 전체를 붙여넣고 Run 하세요.
drop table if exists public.game_probe;

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

