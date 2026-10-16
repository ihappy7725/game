# 프론트엔드 구성 메모 (Next.js + Tailwind v4 + Framer Motion)

프로젝트는 이미 생성되어 있습니다: **`C:\Users\user\frontend`** (백엔드와 나란히).
이 문서는 "무엇이 왜 그렇게 설치되어 있는지"와 실행 방법을 담은 참고 메모입니다.

## 실제 설치된 버전

| 항목 | 버전 |
| --- | --- |
| Node / npm | v24.20.0 / 11.19.0 |
| Next.js | 16.4.2 (App Router, Turbopack 기본) |
| React | 19.3.0 |
| Tailwind CSS | v4 (설정 파일 없이 CSS에서 토큰 정의) |
| Framer Motion | 14.3.0 |
| 그 외 | @supabase/supabase-js, @supabase/ssr, lucide-react, clsx, tailwind-merge |

> Tailwind v4라서 `tailwind.config.js`가 없습니다. 색·반경·그림자 토큰은
> `src/app/globals.css` 의 `@theme` 블록에, 커스텀 유틸리티는 `@utility` 블록에 정의합니다.

재생성이 필요할 때 쓴 명령은 다음과 같습니다.

```powershell
cd C:\Users\user
npx create-next-app@latest frontend --typescript --tailwind --eslint --app --src-dir --turbopack --import-alias "@/*" --use-npm
cd C:\Users\user\frontend
npm install framer-motion @supabase/supabase-js @supabase/ssr lucide-react clsx tailwind-merge
```

## 파일 구조

```
frontend/src/
├─ app/
│  ├─ globals.css          # 디자인 토큰 + 글래스모피즘 유틸리티 (@theme / @utility)
│  ├─ layout.tsx           # lang="ko", Geist + Noto Sans KR 폰트
│  ├─ page.tsx             # 홈: 히어로 + 기능 카드 4개
│  └─ writing/page.tsx     # Writing 첨삭 화면 (백엔드 연동 완료)
├─ components/
│  ├─ GlassWindow.tsx      # macOS 창 모양 유리 패널 (신호등 버튼 + 타이틀바)
│  ├─ FeatureCard.tsx      # 호버 시 떠오르는 유리 카드
│  └─ BackendStatus.tsx    # 타이틀바의 API 연결 표시등
└─ lib/
   ├─ api.ts               # evaluateWriting / evaluateSpeaking / checkBackendHealth
   └─ cn.ts                # clsx + tailwind-merge 헬퍼
```

## 디자인 토큰 요약

`globals.css` 에 정의된 것들입니다.

- **색**: `ink-950/900/800` (뉴욕 야경 배경), `accent-300/400/500` (차가운 블루 액센트), `signal-400` (경고)
- **반경**: `--radius-window` 18px (창), `--radius-card` 14px (카드)
- **그림자**: `--shadow-window` — 멀리 퍼지고 아주 옅게 (macOS 창 특유의 느낌)
- **유틸리티**:
  - `glass` / `glass-soft` — `backdrop-filter: blur() saturate()` 기반 유리판
  - `glass-sheen` — 상단 1px 하이라이트. 유리의 입체감을 만드는 핵심 디테일
  - `grain` — 미세한 노이즈. 넓은 그라데이션의 밴딩을 감춥니다
- `prefers-reduced-motion` 을 존중해 애니메이션을 끄는 블록이 포함되어 있습니다.

## 환경 변수

`frontend/.env.local` 은 이미 생성되어 있고 `NEXT_PUBLIC_SUPABASE_URL` 은 백엔드 `.env` 에서
복사되었습니다. **`NEXT_PUBLIC_SUPABASE_ANON_KEY` 는 플레이스홀더이므로 직접 채워야 합니다**
(Supabase 대시보드 > Project Settings > API > `anon public`).

```ini
NEXT_PUBLIC_SUPABASE_URL=<백엔드 .env 와 동일 - 이미 채워짐>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<직접 입력 필요>
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

> `service_role` 키는 RLS를 우회하므로 **절대 프론트엔드에 두지 마세요.** 백엔드 전용입니다.

## 실행

터미널 두 개를 띄웁니다.

```powershell
# 터미널 1 - 백엔드
cd C:\Users\user\toefl-backend
python -m uvicorn main:app --reload --port 8000
```

```powershell
# 터미널 2 - 프론트엔드
cd C:\Users\user\frontend
npm run dev
```

> 백엔드 패키지(fastapi, openai, supabase)는 miniforge base 환경
> (`C:\Users\user\miniforge3`)에 설치되어 있습니다. `C:\Users\user\venv` 는 pip만 들어 있는
> 빈 가상환경이므로 활성화하면 `ModuleNotFoundError` 가 납니다.

- 프론트: http://localhost:3000
- API 문서(Swagger): http://localhost:8000/docs

> 백엔드 CORS는 `http://localhost:3000` 만 허용합니다. 다른 포트로 띄울 경우
> `main.py` 의 `allow_origins` 를 함께 수정하세요.

## 남은 작업

홈 화면에서 "준비 중"으로 표시된 카드들입니다.

- `/history` — 학습 기록 대시보드. 백엔드 조회 엔드포인트가 필요합니다
- `/practice` — Reading / Listening 모의고사
- Supabase 로그인 연동 (`@supabase/ssr`). 현재는 토큰 없이 호출하므로
  제출 기록이 `user_id = null` 로 저장됩니다
