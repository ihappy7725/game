# 자동 전체화면 오프닝

## 이 Windows PC에서 클릭 없이 전체화면으로 시작하기

1. 프론트엔드 서버 `npm.cmd run dev`를 실행한 상태로 둡니다. 백엔드는 기존대로 별도 실행합니다.
2. 프로젝트의 **`play-fullscreen.cmd`를 더블클릭**하거나 터미널에서 아래 명령을 실행합니다.

```powershell
cd C:\Users\user\Desktop\game
npm.cmd run play:desktop
```

전용 Chrome/Edge 창을 **사이트를 불러오기 전부터 실제 창 전체화면**으로 열고 오프닝을 재생합니다. Esc는 전체화면을 해제하고 오프닝/게임을 나갑니다. 해제 후 다음 클릭에 강제로 다시 전체화면에 들어가지 않습니다. 홈의 전체화면 버튼으로 다시 전환할 수 있습니다. 종료는 창 닫기 또는 Alt+F4입니다.

현재 설치된 Chrome을 우선 사용하며 Edge를 대안으로 찾습니다. 새 브라우저나 추가 패키지를 다운로드하지 않습니다. 프로젝트의 기존 Playwright 개발 의존성을 사용하므로 `npm install`이 되어 있어야 합니다. 서버를 자동 종료/교체하지 않습니다.

일반 브라우저 프로필과 분리한 `.local/game-browser/`에 로그인/설정을 보관합니다. 이 폴더는 Git에서 제외하며 다른 사람에게 공유하지 마세요. 일반 Chrome에서 이미 로그인했더라도 전용 창에서는 한 번 더 로그인해야 할 수 있습니다. 기존 브라우저의 보안·자동재생 설정은 변경하지 않습니다. 영상 소리 자동재생은 별도의 브라우저 정책을 따르며 차단 시 소리 버튼으로 켭니다.

## 일반 웹 주소로 들어갈 때

오프닝 자체는 처음부터 웹 화면 전체를 채웁니다. 주소창/탭까지 숨기는 실제 모니터 전체화면도 즉시 요청하지만 일반 웹사이트의 Fullscreen API에는 사용자 동작 조건이 있습니다. **URL에 접속했다는 이유만으로 모든 브라우저에서 자동 전체화면을 보장할 수 없습니다.** 첫 클릭/전체화면 버튼을 사용하거나 위 전용 실행기를 사용하세요. 웹 배포 후 모든 방문자의 브라우저를 자동으로 바꾸는 기능은 아닙니다.

참고: [MDN Fullscreen 사용자 동작 조건](https://developer.mozilla.org/en-US/docs/Web/API/Element/requestFullscreen), [Chrome 창 상태 제어](https://chromedevtools.github.io/devtools-protocol/tot/Browser/#method-setWindowBounds).

전용 실행기의 창 상태/오프닝/Esc는 로컬 Chrome 자동 검사로 확인합니다. 실제 모니터/다중 모니터에서의 최종 크기와 Edge 동작은 별도 확인이 필요합니다.
