# 레퍼런스 이미지

첨부해 주신 사진 15장이 이미 들어와 있습니다. 파일을 교체하려면 **같은 이름으로 덮어쓰기만** 하면
코드 수정 없이 반영됩니다. 파일을 지워도 화면은 깨지지 않고 `src/lib/scenes.ts` 의 CSS 폴백으로
같은 색감이 렌더링됩니다.

## 배경 (Study / Arcade 테마)

| 파일 | 쓰이는 곳 |
| --- | --- |
| `bg-nypl.jpg` | Study Mode 기본 바탕화면 (뉴욕 공립도서관 열람실) |
| `bg-library.jpg` | Reading & Listening 창 배경 (서가) |
| `bg-whiteboard.jpg` | Writing 창 배경 |
| `desk-study.jpg` | My NYC Dorm (기숙사 책상) |
| `bg-nyc-street.webp` | Arcade Mode 바탕화면 · Yellow Cab Rush |
| `bg-liberty-sunset.jpg` | Arcade 맵 · Memory Boss Raid |

> `bg-nyc-street` 만 확장자가 `.webp` 입니다. 원본이 webp라 그대로 두었습니다.
> `.jpg` 로 바꾸시려면 파일과 함께 `src/lib/scenes.ts` 의 `nycStreet.src` 도 고쳐 주세요.

## 플로팅 위젯 (드래그 가능한 명언 카드·스티커)

| 파일 | 쓰이는 곳 |
| --- | --- |
| `quote-win-learn.jpg` | Card A 원본 대조용 (실제 렌더링은 CSS 재현) |
| `quote-gentle-reminder.jpg` | Card B 원본 대조용 (실제 렌더링은 CSS 재현) |
| `sticker-discipline.jpg` | Discipline 스티커 위젯 |
| `sticker-grateful.jpg` | I'm grateful to be me 스티커 위젯 |

명언 카드 2종은 **사진을 그대로 띄우지 않고 CSS로 재현**합니다. 그래야 텍스트가 선명하게
확대되고, 화면 크기에 맞춰 줄바꿈되며, 스크린리더에도 읽힙니다. 원본 사진은 색·여백을
대조하는 용도로만 남겨 두었습니다.

## 장식 · 보상

| 파일 | 쓰이는 곳 |
| --- | --- |
| `deco-graduation.jpg` | 아이비리그 졸업생 티어 달성 화면 |
| `deco-be-smart.jpg` | 랭킹전 배너 |
| `graph-but-i-did.jpg` | 연속 학습 스트릭 카드 |
| `graph-motivation-discipline.jpg` | 습관 통계 카드 |
| `graph-overthinking-doing.jpg` | 시작하기 유도 카드 |
