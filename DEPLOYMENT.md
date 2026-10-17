# 배포: Vercel 한 프로젝트 (프론트 + 백엔드)

확인 기준: 2026-10-17.

## 선택한 구성

**Vercel 프로젝트 하나**에 Next.js 프론트와 FastAPI 백엔드를 함께 올리고, 계정/DB는 기존 **Supabase**를 유지합니다.

조건은 "카드 등록 없음 + 무료 + 절전 대기 없음"이었습니다. 컨테이너를 24시간 띄워 주면서 카드도 받지 않는 무료 PaaS는 2026년 현재 사실상 없습니다.

- **Northflank Sandbox**: 절전 없지만 무료 플랜에도 카드 등록 필요. 국내 카드 인증(보안 프로그램) 반복 실패로 중단.
- **Render Free**: 카드 불필요하나 [공식 문서](https://render.com/docs/free)상 15분 유휴 후 절전, 기동에 약 1분. 제외.
- **Koyeb**: 유휴 1시간 후 scale-to-zero이며 해제 불가([공식 문서](https://www.koyeb.com/docs/run-and-scale/scale-to-zero)). 제외.
- **Hugging Face Spaces**: Docker Space 생성에 유료 플랜 필요([공식 문서](https://huggingface.co/docs/hub/spaces-overview)). 제외.
- **Fly.io / Railway**: 상시 무료 플랜 없음. 제외.

**Vercel**은 Hobby 플랜이 카드를 요구하지 않고, Python 런타임으로 FastAPI를 그대로 실행합니다([공식 문서](https://vercel.com/docs/frameworks/backend/fastapi)). 요청이 없을 때 비용·자원을 쓰지 않지만 Render식 절전 기동(약 1분)이 아니라 함수 콜드 스타트(보통 1~2초 이내)입니다. 바이트코드를 미리 컴파일해 번들에 넣습니다([변경 기록](https://vercel.com/changelog/python-function-bundles-now-include-precompiled-bytecode)).

[Vercel Services](https://vercel.com/docs/services)(Beta, 전 플랜)로 한 프로젝트 안에 서비스 두 개를 두면 **도메인이 하나**가 됩니다. 그래서 CORS 설정과 별도 백엔드 주소가 필요 없습니다.

알아 둘 제약:
- Hobby 플랜은 **개인·비상업 용도**이며 한도를 넘으면 과금이 아니라 일시 중지됩니다.
- 함수 최대 실행 시간은 Hobby에서 최대 60초입니다. `vercel.json`에 60초로 설정했습니다. 나중에 AI 채점(Whisper)을 켤 때 이 한도를 다시 확인해야 합니다.
- 서버에 디스크 상태를 두지 않습니다. 이 백엔드는 전역 상태·파일 쓰기·백그라운드 작업이 없어 그대로 맞습니다.

## 저장소 구조

```
/                 Next.js 프론트 (src/, public/, package.json)
/backend          FastAPI 백엔드 (main.py, requirements.txt, .python-version)
/vercel.json      서비스 2개와 경로 분배 규칙
```

`vercel.json`의 분배 규칙:

| 요청 경로 | 가는 곳 |
| --- | --- |
| `/api/...` | `backend`의 FastAPI |
| `/healthz` | `backend`의 상태 검사 |
| 그 밖의 모든 경로 | Next.js 프론트 |

`backend/Dockerfile`은 Vercel 배포에 쓰지 않습니다. 나중에 컨테이너 호스트로 옮길 때를 위한 예비 설정입니다.

## 1단계: 코드 준비 (완료)

- `npm run build` 통과(9개 라우트), `tests/test_deployment.py` 5개 통과, 백엔드 21개 라우트 로드 확인.
- 백엔드를 `backend/`로 옮긴 뒤에도 로컬 실행은 루트 `.env`를 그대로 읽습니다.
- `.env`, `.env.local`은 Git에 추적되지 않음을 확인했습니다.
- 백엔드 준비 내용: `/healthz`, 채점 JWT 필수 검증, 사용자 ID 위조 방지, 배포 시 유료 채점 기본 비활성화, 배포용 CORS 환경 설정.

로컬 개발 명령이 바뀌었습니다. 백엔드는 이제 `cd backend` 후 `uvicorn main:app --reload`로 실행합니다. 프론트(`npm run dev`)는 그대로입니다.

## 2단계: Vercel 프로젝트 생성

1. [vercel.com](https://vercel.com/)에 **GitHub 계정으로 로그인**합니다. Hobby(개인) 플랜을 선택하고 Pro 체험을 고르지 않습니다. 카드 입력 화면이 나오면 멈추고 알려 주세요.
2. **Add New → Project**에서 저장소 `ihappy7725/game`, 브랜치 `master`를 가져옵니다.
3. Root Directory는 **저장소 루트**로 둡니다. `vercel.json`이 서비스 두 개를 정의하므로 Framework/Build 설정을 손으로 바꾸지 않습니다.
4. 아래 환경 변수를 넣습니다. 한 프로젝트의 변수는 두 서비스가 함께 사용합니다. 실제 값은 로컬 `.env`·`.env.local`에서 복사하며 채팅/코드에 쓰지 않습니다.

| 이름 | 설정할 값 | 출처 |
| --- | --- | --- |
| `APP_ENV` | `production` | 직접 입력 |
| `PAID_GRADING_ENABLED` | `false` | 직접 입력 |
| `SUPABASE_URL` | 기존 Supabase 프로젝트 URL | `.env` |
| `SUPABASE_SERVICE_ROLE_KEY` | 서버 전용 키. **Sensitive로 표시** | `.env` |
| `NEXT_PUBLIC_SUPABASE_URL` | 공개 Supabase URL | `.env.local` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 공개 anon/publishable 키 | `.env.local` |

`OPENAI_API_KEY`는 넣지 않습니다. `NEXT_PUBLIC_API_BASE_URL`도 **넣지 않습니다** — 설정하지 않으면 프론트가 같은 도메인의 상대 경로를 호출합니다. 여기에 `localhost:8000`이 들어가면 배포가 깨집니다. `CORS_ORIGINS`도 같은 도메인이라 필요 없습니다.

5. Deploy를 누릅니다. 빌드 로그에 Next.js 빌드와 Python 의존성 설치가 각각 올라갑니다.
6. 서비스 루트가 겹친다는 오류가 나면 알려 주세요. 프론트를 `frontend/`로 내리거나 백엔드를 별도 프로젝트로 분리하는 대안이 있습니다. 어느 쪽이든 `backend/` 구조는 그대로 씁니다.

## 3단계: 배포 확인

발급된 주소를 `https://<프로젝트>.vercel.app`이라 하면:

| 확인할 주소 | 기대 결과 |
| --- | --- |
| `/healthz` | `{"status":"ok"}` |
| `/api/game/leaderboard` | 랭킹 JSON (또는 로그인 필요 응답) |
| `/` | 오프닝·홈 화면 |

`/`가 API 상태 JSON을 보여주면 경로 분배가 거꾸로 붙은 것이므로 멈추고 알려 주세요.

## 4단계: Supabase 주소 등록

1. Supabase Authentication → URL Configuration에서 Site URL을 실제 Vercel 주소로 설정합니다.
2. Redirect URLs에 실제 프론트 주소와 개발용 `http://localhost:3000`을 등록합니다. [공식 리디렉션 안내](https://supabase.com/docs/guides/auth/redirect-urls) 참고.
3. Preview 배포로도 로그인을 시험한다면 그 정확한 주소도 등록합니다.

## 5단계: 공개 확인 후 공유

- 기존 계정 로그인/로그아웃/재접속 → 프로필 → 랭킹 조회를 확인합니다. 새 가입/메일 발송은 사용자가 직접 실행할 때만 확인합니다.
- 네 게임의 진입/종료/Esc/정지/소리, 배경 영상, 휴대폰 입력/회전/화면 크기를 확인합니다.
- 게임 기록·책상·뽑기 저장은 실제 코인/DB에 영향을 주므로 사용자가 의도한 플레이에서 확인합니다. 가짜 사용자/코인/기록을 자동 삽입하지 않습니다.
- 비로그인 상태에서 Writing/Speaking 채점 버튼은 비활성화되어야 합니다. 입력·녹음 연습은 계속 가능합니다. 로그인했어도 첫 배포의 AI 채점 요청은 준비 중 안내를 반환합니다.
- 브라우저 개발자도구 네트워크 탭에서 `localhost:8000` 호출이 없는지 확인합니다.
- 확인이 끝난 주소를 테스트 사용자에게 공유합니다. Hobby 플랜의 비상업 조건을 넘는 본 운영은 별도 결정합니다.

## 유료 채점 공개는 별도 단계

무료 호스팅이 OpenAI 채점/Whisper 비용까지 없애지는 않습니다. 현재 배포 기본값은 `PAID_GRADING_ENABLED=false`이며 OpenAI 키 없이도 게임·기록 서버가 시작됩니다. 기존 로컬 환경은 기본 채점을 유지하되 로그인은 필수입니다.

로그인 필수 검증과 전체 차단 스위치는 구현했지만, 계정별 일일 호출 상한/동시 실행 제한/중복 청구 방지의 영속적인 제한은 아직 구현하지 않았습니다. 이를 준비하고 실제 유료 호출 승인을 받은 뒤에만 서버에 OpenAI 키를 등록하고 채점을 켭니다. 단순히 `true`로 바꾸는 것을 공개 운영 준비 완료로 보지 않습니다.
