# 배포 동행: Vercel + 무료 백엔드

확인 기준: 2026-10-17. 현재는 로컬 준비 완료 단계이며 실제 클라우드 배포/결제/원격 Git 푸시는 하지 않았습니다.

## 선택할 구성

프론트엔드는 Vercel, 백엔드는 **Northflank Sandbox를 후보로**, 계정/DB는 기존 Supabase를 유지합니다. 사용자는 무료이면서 유휴 후 긴 기동 대기가 없는 구성을 원합니다.

[Northflank 공식 요금표](https://northflank.com/pricing)는 Sandbox에 절전 없는 상시 실행과 무료 서비스 2개를 명시합니다. 다만 [공식 조건](https://northflank.com/docs/v1/application/billing/pricing-on-northflank)에 따르면 카드 등록이 필요하고 테스트/취미 용도로 제공됩니다. 실제 운영용 플랜으로 권장하지 않습니다. 무료 자격/리소스/지역과 최종 표시 요금은 가입 화면에서 확인해야 합니다. 이 조건을 확인하기 전 서비스 생성이나 유료 전환을 하지 않습니다. 상시 실행이 모든 장애·재배포·초기 응답 지연을 없애는 것은 아닙니다.

비교: Render 무료는 유휴 15분 후 절전([공식 문서](https://render.com/docs/free)), Koyeb 무료도 유휴 1시간 후 절전하며 해제할 수 없습니다([공식 문서](https://www.koyeb.com/docs/run-and-scale/scale-to-zero)). Oracle Always Free VM은 직접 관리와 유휴 자원 회수 조건이 있습니다([공식 문서](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm)).

## 1단계: 지금 할 일 — 무료 계정 조건 확인과 코드 준비

1. [Northflank](https://app.northflank.com/)에 로그인/가입합니다. **Sandbox 무료 플랜**을 선택할 수 있는지 확인합니다. 유료 Pay-as-you-go를 대신 선택하지 않습니다. 카드 번호·인증 정보는 채팅에 보내지 않습니다.
2. 무료 플랜이 보이지 않거나 비용이 표시되면 그 화면에서 멈추고 표시된 플랜 이름/금액만 알려 주세요. 카드가 필요한 무료 플랜을 원하지 않는 경우에도 먼저 대안을 정합니다.
3. VS Code 소스 제어에서 이번 변경을 검토합니다. 현재 GitHub 연결은 `ihappy7725/game`, 로컬 브랜치는 `master`입니다. 최신 수정은 아직 로컬에 있으므로 배포 전에 필요한 소스/자산을 커밋·푸시해야 합니다. `.env`/`.env.local`, 가상환경, 키, 캐시 파일은 포함하지 않습니다. 기존에 추적된 캐시 변경은 커밋 선택에서 제외합니다. 에이전트는 사용자 변경을 일괄 스테이징/커밋/푸시하지 않았습니다.
4. GitHub에서 `Dockerfile.backend`, `runtime_settings.py`, 최신 `main.py`, `src`/`public`의 필요한 변경이 올라왔는지 확인합니다. `.env`와 `.env.local`은 Git 추적되지 않음을 확인했습니다.

현재 로컬 준비 내용: 배포용 CORS 환경 설정, `/healthz`, 채점 JWT 필수 검증, 사용자 ID 위조 방지, 배포 시 유료 채점 기본 비활성화, 백엔드 전용 Dockerfile, 환경 파일/캐시의 이미지·CLI 업로드 제외 규칙. Linux 컨테이너 빌드는 이 PC에 Docker가 없어 아직 실행하지 못했습니다. 실제 첫 클라우드 빌드 로그를 보고 확인합니다.

## 2단계: Northflank 백엔드 생성

무료 플랜 조건과 GitHub 최신 코드가 확인된 후 진행합니다. [공식 시작 안내](https://northflank.com/docs/v1/application/getting-started/build-and-deploy-your-code)를 기준으로 합니다.

1. Northflank에 GitHub 저장소 접근을 연결합니다. 필요한 저장소만 허용합니다.
2. 프로젝트를 만들고 **Combined Service(코드 빌드와 배포)**를 선택합니다. 기존 Supabase가 있으므로 새 DB는 만들지 않습니다.
3. 저장소 `ihappy7725/game`, 최신 코드가 있는 브랜치(현재 `master`)를 선택합니다.
4. 빌드 방식 `Dockerfile`, 경로 `Dockerfile.backend`, 빌드 컨텍스트는 저장소 루트로 설정합니다. 프론트와 Python이 한 저장소에 있으므로 자동 Node 감지에 맡기지 않습니다.
5. 무료로 표시되는 Sandbox 리소스/인스턴스 1개를 선택하고 요금이 무료 범위인지 확인합니다. 무료를 넘어서는 크기·추가 디스크·유료 플랜은 선택하지 않습니다.
6. 아래 환경 변수를 백엔드의 Runtime Variables/Secrets에 설정합니다. 실제 값은 현재 로컬 설정에서 본인이 복사하며 채팅/코드에 쓰지 않습니다.

| 이름 | 설정할 값 |
| --- | --- |
| `APP_ENV` | `production` |
| `PAID_GRADING_ENABLED` | **`false`** |
| `SUPABASE_URL` | 기존 Supabase 프로젝트 URL |
| `SUPABASE_SERVICE_ROLE_KEY` | 기존 서버 전용 키. Secret으로 입력 |
| `PORT` | `8000` |
| `CORS_ORIGINS` | 처음에는 `http://localhost:3000`; 4단계에서 실제 프론트 주소 추가 |

7. 포트 `8000`, 프로토콜 HTTP를 공개 포트로 설정합니다. HTTPS 공개 주소는 플랫폼이 제공합니다. 별도 시작 명령은 Dockerfile의 명령을 사용합니다. `--reload`는 사용하지 않습니다.
8. HTTP 상태 검사 경로를 `/healthz`, 포트를 `8000`으로 설정합니다. [공식 상태 검사 안내](https://northflank.com/docs/v1/application/observe/configure-health-checks) 참고.
9. 무료 조건을 최종 확인한 뒤 배포합니다. 빌드/런타임 오류가 있으면 키를 가린 오류 내용으로 함께 해결합니다.
10. 발급된 공개 주소의 `/healthz`가 `{"status":"ok"}`를 반환하는지 확인합니다. `/`는 화면이 아닌 API 상태 JSON이며 `supabase_enabled:true`, `grading_enabled:false`여야 합니다. 이 단계에서 받은 **공개 백엔드 URL만** 공유하면 됩니다.

Dockerfile은 Python 3.14 계열과 기존 고정 패키지를 사용하고, 앱에 필요한 Python 파일만 복사합니다. `.env`와 영상은 백엔드 이미지에 포함하지 않습니다. Windows의 로컬 Python 3.14.7 검증과 Linux 컨테이너 검증은 구분합니다.

## 3단계: Vercel 프론트 배포

백엔드 공개 URL이 확인된 후 진행합니다.

1. Vercel에서 새 프로젝트를 만들고 같은 GitHub 저장소를 가져옵니다.
2. Framework Preset은 **Next.js**, Root Directory는 저장소 루트로 선택합니다. Install/Build/Output은 Next.js 기본값을 사용합니다(`npm run build`). 프론트 프로젝트에서 `Dockerfile.backend`나 FastAPI를 선택하지 않습니다.
3. 아래 **세 변수만** 프론트 환경 변수에 설정합니다. 필요한 Production/Preview 환경을 각각 선택합니다.

| 이름 | 설정할 값 |
| --- | --- |
| `NEXT_PUBLIC_API_BASE_URL` | 2단계에서 확인한 백엔드 HTTPS 주소, 끝 `/` 없이 |
| `NEXT_PUBLIC_SUPABASE_URL` | 기존 `.env.local`의 공개 Supabase URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 기존 `.env.local`의 공개 anon/publishable 키 |

4. 백엔드의 service-role 키와 OpenAI 키는 Vercel 프론트에 넣지 않습니다. 로컬 `.env`를 통째로 가져오지 않습니다.
5. 테스트 배포를 만들고 실제 발급된 Vercel 주소를 기록합니다. `NEXT_PUBLIC_` 값은 빌드에 들어가므로 바꾸면 재배포해야 합니다. [Vercel 환경 변수](https://vercel.com/docs/environment-variables) 참고.

## 4단계: 주소 연결

1. Northflank 백엔드의 `CORS_ORIGINS`를 실제 Vercel 주소로 설정합니다. 예: `https://내-프로젝트.vercel.app,http://localhost:3000`. 주소에 `/login` 같은 경로는 넣지 않으며 쉼표로 구분합니다. `*.vercel.app` 전체 허용은 하지 않습니다. 별도 Preview 주소로 검사한다면 그 정확한 주소도 추가합니다.
2. 변경 환경 변수가 반영되도록 백엔드를 재배포합니다.
3. Supabase Authentication → URL Configuration에서 Site URL을 실제 프론트 주소로 설정하고 Redirect URLs에 실제로 사용하는 프론트 주소/필요 경로와 개발용 localhost를 등록합니다. [공식 리디렉션 안내](https://supabase.com/docs/guides/auth/redirect-urls) 참고.
4. 오프닝·홈·게임이 있는 주소는 **Vercel 프론트 URL**입니다. 백엔드 URL은 상태 JSON/API용입니다.

## 5단계: 공개 주소 확인 후 공유

- 기존 계정 로그인/로그아웃/재접속 → 프로필 → 랭킹 조회를 확인합니다. 새 가입/메일 발송은 사용자가 직접 실행할 때만 확인합니다.
- 네 게임의 진입/종료/Esc/정지/소리, 배경 영상, 휴대폰 입력/회전/화면 크기를 확인합니다.
- 게임 기록·책상·뽑기 저장은 실제 코인/DB에 영향을 주므로 사용자가 의도한 플레이에서 확인합니다. 가짜 사용자/코인/기록을 자동 삽입하지 않습니다.
- 비로그인 상태에서 Writing/Speaking 채점 버튼은 비활성화되어야 합니다. 입력·녹음 연습은 계속 가능합니다. 로그인했어도 첫 배포의 AI 채점 요청은 준비 중 안내를 반환합니다.
- 환경 변수를 바꾼 뒤 재배포했는지, 브라우저가 `localhost:8000`을 호출하지 않는지 확인합니다. API 미연결이면 백엔드 상태→프론트 API 주소→정확한 CORS 주소 순으로 봅니다.
- 확인이 끝난 Vercel 주소를 테스트 사용자에게 공유합니다. 무료 Sandbox의 적합 범위를 넘는 본 운영/규모 확장은 별도 결정합니다.

## 유료 채점 공개는 별도 단계

무료 호스팅이 OpenAI 채점/Whisper 비용까지 없애지는 않습니다. 현재 배포 기본값은 `PAID_GRADING_ENABLED=false`이며 OpenAI 키 없이도 게임·기록 서버가 시작됩니다. 기존 로컬 환경은 기본 채점을 유지하되 로그인은 필수입니다.

로그인 필수 검증과 전체 차단 스위치는 구현했지만, 계정별 일일 호출 상한/동시 실행 제한/중복 청구 방지의 영속적인 제한은 아직 구현하지 않았습니다. 이를 준비하고 실제 유료 호출 승인을 받은 뒤에만 서버에 OpenAI 키를 등록하고 채점을 켭니다. 단순히 `true`로 바꾸는 것을 공개 운영 준비 완료로 보지 않습니다.
