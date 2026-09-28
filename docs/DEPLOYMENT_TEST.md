# Render 배포 테스트 결과

검증일: 2026-09-28 (Asia/Seoul)

## 실제 생성한 서비스

- 공개 사이트: [https://lotrkdb.onrender.com](https://lotrkdb.onrender.com)
- 웹 서비스: `lotrkdb`, Node, Free, Singapore.
- PostgreSQL: `lotrkdb-postgres`, Free, Singapore.
- Blueprint: `lotrkdb-test`.
- 앱 서버와 DB는 Render 내부 네트워크로 연결합니다. DB 외부 접속을 차단했으며 비밀번호·접속 URL을 프런트엔드에 포함하지 않았습니다.
- 최초 배포 코드: `0e7bdbf`.
- [웹 서비스 관리](https://dashboard.render.com/web/srv-dasvq9g473hc73e52a10)
- [DB 관리](https://dashboard.render.com/d/dpg-dasvq08473hc73e518ig-a)
- [Blueprint 관리](https://dashboard.render.com/blueprint/exs-dasvppbbc2fs73ajuop0)

## 실제 공개 서버 테스트: 9개 통과

| 검증                                              | 결과 |
| ------------------------------------------------- | ---- |
| PostgreSQL 연결 상태                              | 통과 |
| DB에서 카드 1,315장 / 시나리오 143개 조회         | 통과 |
| 로그인하지 않은 사용자의 기록 조회 거부           | 통과 |
| 덱·플레이·캠페인·보유 제품 저장 및 조회           | 통과 |
| 로그아웃 후 새 세션으로 재로그인했을 때 기록 유지 | 통과 |
| 다른 계정의 기록 읽기·쓰기 차단                   | 통과 |
| 잘못된 기록 거부 및 기존 데이터 유지              | 통과 |
| 다른 사이트 Origin에서 보내는 쓰기 요청 차단      | 통과 |
| 임시 테스트 기록 삭제 및 빈 상태 확인             | 통과 |

자동 검증은 `npm run test:deployment -- https://lotrkdb.onrender.com`으로 재실행할 수 있습니다. 검사 전용 계정 두 개는 빈 상태로 남겨두며 세션은 로그아웃했습니다. 실제 사용자 기록은 사용하지 않았습니다.

## 추가 검증

- [GitHub Actions](https://github.com/AikiToWeb/LOTRKDB/actions/runs/36382646434): 실제 임시 PostgreSQL을 사용하는 통합 테스트 포함 전체 9개 테스트와 production build 통과.
- 공개 사이트: 첫 화면 표시, 한국어 이름 ‘아라고른’ 검색 결과 8개, 로그인·가입 화면 표시 확인.
- 공개 화면 검사 중 브라우저 콘솔 오류 없음.
- 기존 모바일 검증: 390px 화면에서 가로 넘침 없이 메뉴·카드 도서관 이동과 반응형 배치 확인. Render 배포 전 같은 UI 코드 기준이며 실제 휴대폰의 로그인/동기화는 사용자가 추가로 확인할 수 있습니다.

## 테스트 환경의 제한

- 무료 Render PostgreSQL은 생성 후 30일에 만료됩니다. 현재 DB는 2026-09-28 생성됐으므로 2026-10-28 무렵 만료 전에 JSON 백업을 보관하고 Render 화면의 정확한 만료 시각을 확인하세요.
- 무료 웹 서비스는 유휴 시 대기 상태에 들어가 첫 요청의 시작 시간이 길어질 수 있습니다.
- 테스트 계정은 이메일 확인 없이 가입합니다. 이메일 비밀번호 재설정 및 비밀번호 변경 기능은 연결하지 않았습니다.
- 서로 다른 물리적 기기에서의 동시 사용은 별도 사용자 확인이 필요합니다. 이번 자동 검증에서는 독립 계정과 새 로그인 세션으로 서버 저장과 계정 격리를 확인했습니다.
