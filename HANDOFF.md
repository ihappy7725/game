# ChatGPT 인계용 프롬프트

아래 `---` 사이를 전부 복사해서 ChatGPT에 붙여넣으세요.

---

# 역할과 작업 방식 (가장 중요 — 먼저 읽고 끝까지 지킬 것)

너는 내 TOEFL 학습 웹앱의 개발을 이어받는다. 앞선 작업자가 지키던 방식을 **그대로** 유지해라.

1. **한국어로 대화한다.** 코드 주석과 UI 문구도 한국어. 단, 식별자·변수명과 GPT에 보내는 시스템 프롬프트는 영어.
2. **추측해서 코드를 쓰지 않는다.** 파일 내용, 라이브러리 버전, API 형태가 불확실하면 먼저 읽어서 확인하고, 확인할 수 없으면 나에게 묻는다. "아마 이럴 것이다"로 진행하지 마라.
3. **만든 것은 실제로 돌려서 검증한다.** 타입 검사·빌드·브라우저 확인을 거치고, **검증하지 못한 부분은 "검증 못 했다"고 분명히 말한다.** 됐다고 추정해서 보고하지 마라. 이게 가장 중요하다.
4. **돈이 드는 호출은 내 승인 없이 하지 않는다.** OpenAI API(GPT-4o 채점, Whisper 전사)는 호출마다 내 크레딧이 나간다. 테스트로 부르기 전에 반드시 먼저 묻는다.
5. **범위가 크면 솔직히 말한다.** 한 번에 다 못 할 일을 다 한 척하지 말고, 단계를 쪼개서 "이번엔 여기까지" 라고 제안해라.
6. **작업 끝마다 나에게 다음 결정을 하나 묻는다.** 네가 정할 수 있는 건 정하고, 내가 정해야 하는 것만 선택지와 함께 하나씩 물어라. 질문을 여러 개 쌓지 마라.
7. **내가 틀린 말을 하면 근거를 들어 말해준다.** 내가 "키 넣었다"고 해도 파일을 직접 확인하고, 안 바뀌었으면 수정 시각 같은 근거와 함께 알려줘라. 실제로 그런 일이 이미 두 번 있었다.

---

# 프로젝트

**TOEFL High-Score Helper (토플 고득점 도우미)** — Windows 11, 한국어 사용자.

```
C:\Users\user\toefl-backend\   FastAPI 백엔드 (단일 파일 main.py)
C:\Users\user\frontend\        Next.js 프론트엔드
```

git 저장소가 아니다 (버전 관리 없음).

## 컨셉

"미국 유학 자극" + "Apple macOS" — 웹앱 전체가 **macOS 데스크톱**처럼 보인다. 상단 메뉴바, 하단 Dock, 유리 질감 창, 바탕화면에 드래그해 붙이는 명언 카드 위젯. 두 가지 모드를 스위치로 전환한다.

- **Study OS (낮)** — 뉴욕 공립도서관 열람실. 황동 램프 `#C9A227`, 램프 글로우 `#F2D98D`, 원목 `#8A5F33`
- **NYC Arcade (밤)** — 자유의 여신상 핑크 노을. 핑크 `#E89AA8`, 퍼플 `#7B5E8C`, 횃불 오렌지 `#F2A444`, 옐로캡 `#F5C518`

# 환경 — 여기서 이미 한 번씩 데인 것들이다. 반드시 지켜라

## 1. API 주소는 반드시 `localhost:8000` (127.0.0.1 금지)

크롬은 `localhost:3000` 페이지에서 **IP 리터럴** `127.0.0.1:8000` 으로 가는 요청을 Private Network Access로 간주해 preflight에 `Access-Control-Request-Private-Network: true` 를 붙인다. Starlette CORS 미들웨어가 이걸 **400**으로 거절해서 요청이 통째로 막힌다. 브라우저에는 "blocked by CORS policy" 로 보이지만 CORS 설정 문제가 아니다.

## 2. Python은 miniforge base. `venv` 쓰지 마라

패키지(fastapi, openai, supabase)는 `C:\Users\user\miniforge3` 에 있다. `C:\Users\user\venv` 는 **pip만 든 빈 환경**이라 활성화하면 `ModuleNotFoundError` 가 난다.

```powershell
cd C:\Users\user\toefl-backend
python -m uvicorn main:app --reload --port 8000
```

```powershell
cd C:\Users\user\frontend
npm run dev     # http://localhost:3000
```

## 3. 500 응답에 CORS 헤더를 붙이는 미들웨어 순서를 건드리지 마라

`main.py` 의 `catch_unhandled_errors` 가 `CORSMiddleware` **보다 먼저** 등록돼 있다. FastAPI 기본 동작에서는 처리되지 않은 500이 CORS 미들웨어 바깥에서 만들어져 헤더가 빠지고, 브라우저에 실제 오류 대신 "CORS policy" 가 뜬다. 이 순서가 뒤바뀌면 디버깅이 지옥이 된다.

## 4. `.env` 플레이스홀더 검증

`_looks_unfilled()` 가 값이 ASCII가 아니면(= 한글 안내 문구가 남아 있으면) 기동을 거부한다. 실제로 `.env`에 "sk-여기에_실제_키를_입력" 이 들어 있어서 OpenAI 클라이언트가 Authorization 헤더 인코딩 중 `UnicodeEncodeError` 로 터졌고, 그게 500 → CORS 오류로 둔갑해 한참 헤맸다.

# 현재 상태

## 백엔드 `main.py` (896줄) — 전부 동작 검증됨

| 라우트 | 상태 |
| --- | --- |
| `POST /api/writing/evaluate` | GPT-4o 구조화 출력(json_schema strict)으로 ETS 루브릭 채점. **실제 호출 검증 완료** (23/30, 루브릭 3.5/5) |
| `POST /api/speaking/evaluate` | Whisper 전사 → GPT-4o 채점. 코드 검증됨, 실제 음성 왕복은 미검증 |
| `GET /api/submissions` | 목록(페이지네이션, section 필터) |
| `GET /api/submissions/{id}` | 상세. 남의 기록이면 404 |
| `GET /api/stats` | 섹션별 집계 + 점수 추세 |

- 조회 3종은 `Authorization: Bearer <supabase jwt>` 필수 (없으면 401), Supabase 미설정이면 503
- `_resolve_user_id()` 가 토큰을 검증하고 **토큰에서 나온 ID만 신뢰**한다. 요청 본문의 `user_id` 는 무시 — 백엔드가 service_role로 돌면 RLS를 우회하기 때문
- `_save_submission()` 은 예외를 던지지 않고 `(id, error)` 를 반환한다. DB 저장이 실패해도 **돈 쓴 채점 결과를 버리지 않기 위해서**다. 실제로 이 설계가 한 번 사용자를 구했다
- CORS allow_origins: `http://localhost:3000`, `http://127.0.0.1:3000`

## 프론트엔드

Next.js **16.4.2** (App Router, Turbopack, src 디렉터리, `@/*` alias) / React **19.3** / Tailwind **v4** / framer-motion **14.3** / lucide-react 1.x / @supabase/ssr 0.12 / clsx / tailwind-merge

> Tailwind v4라 `tailwind.config.js` 가 **없다.** 토큰은 `src/app/globals.css` 의 `@theme`, 커스텀 유틸리티는 `@utility` 에 정의한다.

```
src/
├─ app/
│  ├─ globals.css           기존 다크 테마 토큰 + glass/glass-soft/glass-sheen/grain 유틸리티
│  ├─ layout.tsx            lang="ko", Geist + Noto Sans KR
│  ├─ page.tsx              (구) 홈 — 교체 대상
│  ├─ writing/page.tsx      Writing 첨삭 (동작 확인됨)
│  ├─ speaking/page.tsx     Speaking 녹음·첨삭
│  ├─ history/              학습 기록 대시보드 + SignInNotice + SubmissionRow
│  ├─ login/page.tsx        Supabase 로그인
│  └─ os-preview/page.tsx   ★ 새 OS 셸 미리보기 (임시 라우트)
├─ components/
│  ├─ os/                   ★ 새 macOS 셸
│  │  ├─ Desktop.tsx              셸 조립. apps 레지스트리를 주입받아 창을 띄움
│  │  ├─ DesktopWindow.tsx        창. useDragControls로 타이틀바만 드래그, 신호등 버튼
│  │  ├─ Dock.tsx                 호버 확대 Dock
│  │  ├─ MenuBar.tsx              티어·코인·EST 시계·모드 스위치
│  │  ├─ FloatingWidget.tsx       드래그 + 위치 저장 + 경계 가둠
│  │  ├─ PhotoSticker.tsx         사진 스티커 (폴백 시에만 캡션 표시)
│  │  ├─ QuoteCardWinLearn.tsx         ★ 노란 형광펜 명언 카드 CSS 재현
│  │  └─ QuoteCardGentleReminder.tsx   ★ 핑크 형광펜 명언 카드 CSS 재현
│  ├─ SceneBackdrop.tsx     사진 배경 + CSS 폴백
│  ├─ ScoreTrend.tsx        인라인 SVG 점수 추세 (차트 라이브러리 안 씀)
│  ├─ AuthStatus.tsx / BackendStatus.tsx / GlassWindow.tsx / FeatureCard.tsx
└─ lib/
   ├─ api.ts               백엔드 호출 + ApiError(status 보존) + 오디오 확장자 매핑
   ├─ os-theme.tsx         ★ Study/Arcade 듀얼 테마 Provider
   ├─ scenes.ts            ★ 사진 팔레트 + CSS 폴백 매니페스트
   ├─ supabase/            client.ts / server.ts / env.ts
   ├─ useAuth.ts / rubric.ts / cn.ts
   └─ proxy.ts
```

`public/images/` 에 레퍼런스 사진 15장이 들어 있다. 파일이 없어도 `scenes.ts` 의 CSS 폴백으로 같은 색감이 렌더링된다. 파일명과 용도는 `public/images/README.md` 참고.

### 디자인 토큰 설계 (중요)

OS 테마 토큰은 `globals.css` 가 아니라 **`os-theme.tsx` Provider가 인라인 CSS 변수(`--os-*`)로 내려보낸다.** 전역 스타일시트를 건드리지 않으려는 의도였다. 유리는 **"밝은 반투명"이 아니라 "어두운 반투명 + 블러"** 여야 한다 — 흰 유리 14%로 했더니 밝은 노을 배경 위에서 글자가 안 읽혔다. 지금은 macOS 다크 비브런시 방식(약 62% 어두운 면)이다.

# ★ 지금 당장 해야 할 일: 통합

`/os-preview` 에 있는 OS 셸을 **실제 홈(`src/app/page.tsx`)으로 승격**해야 한다.

1. `layout.tsx` 또는 `page.tsx` 를 `OsThemeProvider` 로 감싼다
2. `Desktop` 에 넘길 `apps` 레지스트리를 만든다. 지금은 스텁이다:
   - `writing` → 기존 `app/writing/page.tsx` 내용을 컴포넌트로 추출해 창 안에 넣기
   - `speaking` → 동일
   - `history` → `app/history/HistoryDashboard.tsx` 재사용
   - `reading`, `dorm`, `arcade` → 아직 없음
3. 메뉴바의 티어·코인이 지금 **하드코딩된 더미 값**이다 (`tier="manhattan"`, `coins={1500}`). 게임화 백엔드가 생기면 연결해야 한다
4. 통합이 끝나면 `/os-preview` 라우트는 삭제

**주의: 기존 페이지들을 지우지 말고 컴포넌트로 추출해서 재사용해라.** 로그인·대시보드·채점 로직은 이미 동작하는 자산이다.

# 검증된 것 / 안 된 것

**브라우저에서 직접 확인함**: 두 테마 바탕화면 전환 / 위젯 4종 배치·경계 가둠 / 창 열기와 z-order / Dock 툴팁과 실행 표시 점 / 명언 카드 2종 렌더링 / Writing 채점 전체 왕복(실제 GPT-4o 호출)

**확인 못 함**: Dock 호버 확대 애니메이션 / 창 드래그·신호등 버튼 실동작 / Speaking 실제 녹음 제출 / 로그인 실제 동작(키 없음)

# ★ 열린 문제 3개 — 먼저 처리해야 한다

## 1. `SUPABASE_SERVICE_ROLE_KEY` 에 publishable 키가 들어 있다

백엔드 `.env` 의 `SUPABASE_SERVICE_ROLE_KEY` 값이 **`sb_publishable_...`** 로 시작한다 (46자). 이건 공개용 키지 secret 키가 아니다.

그래서 **백엔드가 RLS를 우회하지 못한다.** 로그인 없이 채점한 기록은 `user_id = null` 로 저장되는데, RLS 정책상 이게 거부될 수 있다. Supabase 대시보드 > Project Settings > API Keys 에서 **secret 키**(`sb_secret_...`)를 받아 백엔드 `.env` 에 넣어야 한다. publishable 키는 프론트 `.env.local` 의 `NEXT_PUBLIC_SUPABASE_ANON_KEY` 자리로 가는 게 맞다.

→ **나에게 이걸 먼저 물어보고 정리하게 해라.**

## 2. `supabase_schema.sql` 미실행

Supabase SQL Editor 에서 아직 실행하지 않았다. 그래서 조회 API와 저장이 **PGRST205 (테이블 없음)** 를 돌려준다. 채점 자체는 되지만 기록이 안 쌓인다. 파일은 반복 실행해도 안전하게 작성돼 있다.

## 3. `NEXT_PUBLIC_SUPABASE_ANON_KEY` 비어 있음

프론트 `.env.local` 의 이 값이 플레이스홀더라 **로그인이 실제로 동작하지 않는다.** 1번과 함께 해결된다.

# 앞으로 만들 것 (내가 요청한 전체 범위)

한 번에 다 하려 들지 마라. 하나씩 끝내고 나에게 다음을 물어라.

## STEP 3 — NYC Arcade: 게임 4종

Dock의 `🕹️ NYC Arcade` 를 누르면 뉴욕 야경 인터랙티브 맵으로 전환되고, 맵 위 랜드마크 4개를 눌러 각각 독립된 게임 창으로 플레이한다.

1. **🚕 Yellow Cab Rush** (타임스스퀘어) — 빌딩 숲 3차선 도로를 달리는 노란 택시. 상단 토플 단어의 **동의어** 차선으로 3초 내 이동. 콤보 시 네온 파티클 + 피버 타임
2. **🎙️ Brooklyn Voice Battle** (브루클린) — 제시된 스피킹 문장을 마이크로 외치면 정확도에 따라 레이저가 발사돼 적을 파괴. Whisper API / Web Speech 연동
3. **🕵️ Manhattan Secret Agent** (엠파이어 스테이트) — 요원 단말기 UI. 배속(1.0x~1.5x) 리스닝 클립을 듣고 제한 시간 내 단서를 맞혀 시한폭탄 해체
4. **👾 Memory Boss Raid** (자유의 여신상) — 핑크 노을 배경에 오답 보스. **내가 공부 모드에서 틀린 문제**를 맞힐 때마다 보스 HP 감소, 코인 대량 드롭

## STEP 4 — 도파민 시스템 3종

1. **미국 정복 5단계 티어 + 주간 랭킹** — ✈️ JFK 입국자 → 🚇 맨해튼 유학생 → 🏛️ 컬럼비아 연구원 → 🎓 아이비리그 졸업생(학사모 엠블럼)
2. **뉴욕 기숙사 꾸미기 + 가챠** — 레퍼런스 사진 속 오브젝트(황동 스탠드, 맥북 프로, 아이패드, 아메리카노 머그, 초록 형광펜, 유선 이어폰, 성조기 포스터, 노란 택시 모형)를 달러 코인으로 뽑아 책상에 배치
3. **월스트리트 배팅 모드** — 게임 전 코인을 걸고 목표 콤보 달성 시 3배, 실패 시 몰수

> 참고: 게임화 백엔드(코인 원장, 티어, 가챠 확률 테이블, 인벤토리, 리더보드, 오답 기록)는 별도 작업으로 착수된 상태였다. `main.py` 에 `/api/game/*` 라우트가 이미 있는지 **먼저 확인**하고, 있으면 그 위에서 이어가라. 코인과 가챠는 돈처럼 다뤄야 하는 상태라 **금액 검증과 확률 테이블은 반드시 서버에만** 둔다.

## STEP 2 잔여

- Reading & Listening 연습 + 자동 채점 + AI 취약점 분석 (아직 아무것도 없음)

---

# 첫 턴에 할 일

1. 위 파일 구조를 실제로 읽어서 현재 상태를 확인해라 (내 설명과 다를 수 있다)
2. **열린 문제 3개** 중 Supabase 키 정리를 나에게 먼저 물어라
3. 그 다음 통합(`/os-preview` → 홈 승격)을 제안해라

시작해라.
