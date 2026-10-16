# Codex 인계용 프롬프트

아래 `---` 사이를 전부 복사해서 Codex에 붙여넣으세요.

---

현재 Windows의 `C:\Users\user\Desktop\game` 프로젝트에서 개발을 이어서 진행해 주세요. 설명이나 계획만 제시하지 말고 실제 로컬 소스를 읽고, 필요한 파일을 수정하고 검증하세요.

먼저 `AGENTS.md`, `HANDOFF.md`, 실제 코드를 읽으세요. 문서와 코드가 다르면 **실제 코드를 기준으로** 판단하세요. Next.js 관련 변경 전에는 `node_modules/next/dist/docs/`의 해당 가이드를 반드시 읽으세요.

## 작업 방식

- 한국어로 대화하고, 주석·UI 문구도 한국어로 작성하세요.
- 추측해서 코드를 쓰지 마세요. 불확실하면 파일을 읽어 확인하고, 확인할 수 없으면 물어보세요.
- **검증하지 못한 것은 "검증 못 했다"고 분명히 말하세요.** 모의 테스트 통과를 실제 서비스 검증으로 표현하지 마세요.
- **실제 유료 GPT·Whisper 호출은 사용자의 명시적 승인 없이 하지 마세요.**
- 작업 끝마다 다음 결정을 하나만 물으세요.
- 검사 규칙을 끄거나 TypeScript·린트 검사를 우회하지 마세요.
- 사용자가 실행 중인 서버를 임의로 종료하지 마세요.
- `.env` / `.env.local`을 수정하거나 키 값을 출력·채팅·Git에 포함하지 마세요.

## 프로젝트

**TOEFL OS** — 미국 유학 자극 + macOS 데스크톱 + 아케이드 컨셉의 토플 학습 웹앱.
백엔드(FastAPI `main.py`)와 프론트엔드(Next.js `src/`)가 한 폴더에 있습니다.

Next.js 16.4.2 (App Router, Turbopack, `@/*` alias) / React 19.3 / Tailwind v4(설정 파일 없음, `globals.css`의 `@theme`·`@utility`) / framer-motion 14.3 / @supabase/ssr / FastAPI + Supabase.

## 환경 — 이미 한 번씩 데인 것들입니다. 반드시 지키세요

1. **API 주소는 `localhost:8000` 고정. `127.0.0.1` 쓰지 마세요.** 크롬이 localhost 페이지에서 IP 리터럴로 가는 요청을 Private Network Access로 보고 preflight에 전용 헤더를 붙이는데, Starlette CORS 미들웨어가 400으로 거절해 요청이 통째로 막힙니다.
2. **백엔드 실행은 `python -m uvicorn main:app --reload --port 8000`.** 패키지는 miniforge base(`C:\Users\user\miniforge3`)에 있습니다. `C:\Users\user\venv`는 pip만 든 빈 환경이라 활성화하면 `ModuleNotFoundError`가 납니다.
3. **`main.py`의 `catch_unhandled_errors` 미들웨어는 `CORSMiddleware`보다 먼저 등록돼야 합니다.** 순서가 바뀌면 처리되지 않은 500에 CORS 헤더가 빠져서, 브라우저에 진짜 오류 대신 "blocked by CORS policy"가 뜹니다.
4. **`.env` 플레이스홀더 검증**: `_looks_unfilled()`가 값이 ASCII가 아니면 기동을 거부합니다.
5. **SQL은 `sql_steps/`의 두 파일로 나눠 실행하세요.** `supabase_gamification.sql` 전체를 SQL Editor에 한 번에 붙여넣으면 실패합니다(원인 미특정). Editor가 한 트랜잭션으로 처리해 한 줄만 실패해도 전부 롤백됩니다.
6. **SQL을 고치면 `pglast`로 먼저 검사하세요** — `parse_sql`(최상위)과 `parse_plpgsql`(함수 본문) 둘 다. 이미 설치돼 있습니다.

## 백엔드 현황 (`main.py`, 약 1,545줄)

학습 API 5개와 게임 API 8개, 총 13개 라우트. 전부 `Authorization: Bearer <supabase jwt>` 필요(없으면 401), Supabase 미설정이면 503.

| 구분 | 경로 |
| --- | --- |
| 학습 | `POST /api/writing/evaluate`, `POST /api/speaking/evaluate`, `GET /api/submissions`, `GET /api/submissions/{id}`, `GET /api/stats` |
| 게임 | `GET /api/game/state`, `POST /api/game/coins`, `POST /api/game/gacha`, `GET /api/game/inventory`, `POST /api/game/inventory/place`, `GET /api/game/leaderboard`, `GET /api/game/mistakes`, `POST /api/game/mistakes` |

### 게임 백엔드에서 절대 깨면 안 되는 설계

- **잔액의 진실은 원장(`game_coin_ledger`)**, `game_profiles.coin_balance`는 캐시입니다. 반드시 DB 함수를 통해서만 바꾸세요. 어긋나면 `game_recompute_balance()`로 복구합니다.
- **잔액 검사·일일 상한 집계·원장 기록·캐시 갱신이 전부 한 트랜잭션 안에서, `FOR UPDATE` 잠금 뒤에** 일어납니다. 파이썬에서 "조회 후 지급"으로 나누면 동시 요청이 같은 잔여 상한을 읽고 둘 다 통과합니다. 실제로 그 버그가 있었고 고친 것입니다.
- **가챠 확률표(`game_items.weight`)는 DB 안에만** 있고 추첨도 DB가 합니다.
- **금액과 xp를 클라이언트에서 받지 않습니다.** reason + 성과만 받고 서버가 계산합니다. `gacha_draw`·`admin_grant`·`bet_win` 같은 서버 전용 사유는 요청 자체가 422로 거부됩니다.
- **티어는 코인이 아니라 `xp` 기준**입니다. 학습(60xp)이 게임(20xp)보다 커서 게임만으로는 승급할 수 없습니다.

### 남아 있는 신뢰 한계

어휘 게임 점수는 결국 클라이언트가 보고하는 값입니다. 요청을 직접 만들면 상한까지는 부풀릴 수 있습니다. 완전히 막으려면 게임 진행을 서버에서 검증해야 하며 범위 밖입니다. 1회 120 / 하루 600코인 상한으로 피해를 가둬 두었습니다. **"서버 검증 완료"라고 쓰지 마세요.**

## 검증된 것 / 안 된 것

**실제 Supabase DB로 검증 완료** (테스트 데이터는 삭제했고 카탈로그만 남김):
- 일일 상한이 잠금 안에서 정확히 적용 (상한 600에 100→100, 550→500, 100→0)
- 가챠 잔액 부족 시 `INSUFFICIENT_FUNDS`로 전체 롤백, 아이템 미지급
- 원장과 잔액 캐시 drift 0
- 엔드포인트 8개 전 구간 (상한·배치·404·오답 졸업·랭킹)

**검증 안 된 것**:
- **실제 Supabase JWT로 로그인해 호출하는 경로** (검증 시 `_require_user_id`를 실제 계정 ID로 대체했습니다)
- 동시 요청 경합 테스트
- 실제 유료 GPT 채점·Whisper 전사
- 물리 마이크 녹음

## 프론트엔드 현황

`src/app/page.tsx`가 `OsThemeProvider > GameStateProvider > ProgressionProvider > LearningHub` 구조입니다.

- `src/lib/api.ts` — 백엔드 호출. 게임 타입(`GameState`, `GameReward`, `GameTier` 등)이 백엔드 응답 모델과 필드명까지 일치하는 것을 확인했습니다. **백엔드를 고치면 여기도 함께 고치세요.**
- `src/lib/game-state.tsx`, `src/lib/progression.tsx` — 코인·티어·진행도 상태
- `src/components/arcade/` — 게임 4종 (YellowCabRush, BrooklynVoiceBattle, ManhattanSecretAgent, MemoryBossRaid), 결과 저장, 점수 공유
- `src/components/dorm/` — 기숙사, 가챠, 랭킹
- `src/components/home/` — LearningHub, ProgressPanel, StudyPractice 등
- `src/components/os/` — macOS 셸 (MenuBar, Dock, DesktopWindow, 드래그 위젯, 명언 카드 2종 CSS 재현)

## 지금 해야 할 일

1. **현재 소스를 먼저 읽고 중복 구현하지 마세요.** 게임 4종과 기숙사·가챠·랭킹은 이미 있습니다.
2. **실제 로그인 상태에서 브라우저로 전 구간을 확인하세요.** 백엔드를 띄우고 `npm run dev`로 프론트를 띄운 뒤, 로그인 → 어휘 게임 플레이 → 코인 적립 → 메뉴바 반영 → 가챠 → 기숙사 배치 → 랭킹까지. 이게 아직 검증되지 않은 가장 큰 구멍입니다.
3. 실패하는 지점이 있으면 먼저 고치세요.
4. `npm run build`, `npx tsc --noEmit`, `npm run lint` 가 모두 0으로 끝나야 합니다.
5. 끝나면 `HANDOFF.md`를 갱신하고, 변경 사항·실제 검증 결과·미검증 항목·사용자가 브라우저에서 직접 확인할 행동을 구분해 보고하세요.

---
