# 한국어 카드와 RingsDB 참고 범위

카드 검색 화면의 상단 적갈색 메뉴, 제품별 탐색, 영역 버튼, 검색 필터, 표/이미지 보기, 영문 이름 병기를 [RingsDB](https://ringsdb.com/search)에서 참고했습니다. 덱 빌더에서는 한국어 효과 검색, 카드 상세, 유형별 정렬, 검색 결과 페이지 이동을 지원합니다.

현재 카탈로그 1,315종의 효과를 한국어로 표시합니다. 기본판 73종과 드워프 스타터의 추가 28종, 합계 101종은 프로젝트에서 원문과 대조해 검수했습니다. 나머지 1,214종은 Google Translate 자동 번역이며 화면에 구분 표시합니다. 공식 한국어 번역으로 표기하지 않습니다. 영문 효과는 각 카드의 ‘영문 효과 원문 보기’에서 확인할 수 있습니다.

## 한글 이미지

[보드라이프 슈로님의 드워프 스타터 v3 자료](https://boardlife.co.kr/bbs_detail.php?bbs_num=9580&tb=info_files), 2024-04-06판의 [공개 PDF](https://drive.google.com/file/d/1Yq6L-_jzzIHk-saDACfFAieadK1bdsQ2/view)를 확인해 31종의 카드 이미지를 추출했습니다. 공식 한국어판이 아닌 비공식 팬 번역이며, 이미지 옆에 제작자와 원문 게시글을 연결합니다. 그림과 카드 내용은 원본 그대로입니다. 여기에 없는 카드는 RingsDB의 영문 이미지와 한국어 효과를 함께 표시합니다.

- 이미지 코드/출처: `public/data/ko-images.json`
- 개별 이미지: `public/images/ko/`
- 한국어 데이터: `public/data/ko.json`
- 검수 번역: `public/data/ko-reviewed.json`

카탈로그 갱신 후 `npm run data:localize`로 신규/변경된 공개 효과를 번역하고 검수 파일을 반영합니다. 번역은 빌드 전 수행하며 앱 사용 중 외부 번역 요청은 없습니다. 사용자의 이메일, 덱, 기록은 번역 서비스에 전송하지 않습니다. 원문이 변경된 카드의 검수 파일은 새 효과를 직접 대조해 수정해야 합니다.

이미지 재추출은 원본 PDF를 `tmp/pdfs/korean-dwarves.pdf`에 저장한 뒤 `python scripts/extract-korean-cards.py`로 수행합니다. Poppler와 pypdf가 필요합니다. 188MB 원본 PDF는 저장소에 포함하지 않습니다.

# 한글판 제품 구성

한글판 제품은 코어(개정판), 어둠숲의 암흑 시나리오 확장, 회색산맥 캠페인 확장, 회색산맥 영웅 확장으로 구분한다. 제품의 한글판 출시 여부는 카드 이미지의 번역 출처와 별개다. 기존 드워프 스타터 이미지는 계속 비공식 팬 번역으로 표시한다. 공식 한글판 전체 카드 이미지 파일은 확보하지 못했으며, 이미지 옆 한국어 효과 번역을 제공한다.

회색산맥 영웅 확장은 RingsDB의 원래 로바니온/회색산맥 사이클 카드 75종(영웅 8종, 실물 209장)을 재수록한다. 프로젝트 제품 코드 `EMHE`로 보유 필터를 지원하며 카드 번호는 유지한다. 캠페인 확장의 9개 시나리오는 기존 시나리오 ID를 유지하므로 플레이 기록이 이어진다. 코어 3개, 어둠숲의 암흑 2개 시나리오도 같은 방식으로 연결한다. 제품 구성은 `scripts/korean-products.mjs`에서 관리하며 데이터 동기화 시 다시 적용된다. RingsDB 원본 113개 제품에 프로젝트 재수록 제품 1개를 추가해 총 114개 제품을 표시한다.

구성 근거: [히트게임즈 한글판 안내](https://boardlife.co.kr/bbs_detail.php?bbs_num=15643&tb=board_news), [FFG 영웅 확장](https://www.fantasyflightgames.com/en/products/the-lord-of-the-rings-the-card-game/products/ered-mithrin-hero-expansion/), [FFG 캠페인 확장](https://www.fantasyflightgames.com/en/products/the-lord-of-the-rings-the-card-game/products/ered-mithrin-campaign-expansion/).
