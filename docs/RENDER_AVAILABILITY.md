# Render 무료 서비스 접속 유지

## 기본 방식: 외부 HTTP 스케줄러

브라우저가 닫히고 사용자의 PC가 꺼져 있어도 요청을 보내는 외부 서비스를 사용한다. 2026-09-29 cron-job.org 작업 8534467을 등록하고 활성화했다. 즉시 실행에서 HTTP 200 OK, 296ms 및 PostgreSQL connected 응답을 확인했다. 작업 관리: https://console.cron-job.org/jobs/8534467 (본인 계정 로그인 필요).

첫 자동 예약 실행도 한국 시간 2026-09-29 11:25:13에 Successful / HTTP 200 OK로 확인했다. 예약 시각은 11:25:00, 실행 지연은 13.13초, 요청 시간은 1.97초였다.

등록된 HTTP 작업 설정:

- 제목: LOTRKDB 서버 접속 유지
- URL: https://lotrkdb.onrender.com/api/health
- 요청: GET, 인증·쿠키·요청 본문 없음
- 일정: 매일 5분마다 (시간대에 관계없이 하루 종일)
- 상태: 활성화
- 응답 저장: 짧은 JSON 상태를 실행 기록에서 확인
- 예상 응답: HTTP 200, `status: ok`, `database: connected`

이 엔드포인트는 이미 Cache-Control: no-store를 적용한다. 사용자 계정, 덱, 플레이 기록을 조회하거나 변경하지 않는다. 최초 등록 전 서버를 깨우고 수동 시험 실행에 성공한 뒤, 예약 실행 기록에서 연속 실행 간격을 확인한다. 최초 콜드 스타트는 외부 스케줄러의 요청 제한 시간을 초과할 수 있지만 서버를 깨우는 요청은 전달된다.

외부 작업을 설정하려면 cron-job.org 계정이 필요하다. 신규 비밀번호와 계정 인증·약관 동의는 사용자가 직접 진행한다. 운영 중단은 cron-job.org의 해당 작업 비활성화로 처리한다.

## 기존 GitHub 작업: 보조 확인용

`.github/workflows/render-availability.yml`의 `Check Render availability`는 5분 간격으로 예약되어 있지만 실제 실행 간격을 보장하지 않는다. 2026-09-29 조사에서 최근 예약 실행 시각은 UTC 2026-09-28 15:39, 21:23, 2026-09-29 01:10으로, 수 시간의 공백이 확인됐다. 따라서 이 작업만으로 15분 유휴 절전을 방지할 수 없다.

- 실행 내역: https://github.com/AikiToWeb/LOTRKDB/actions/workflows/render-availability.yml
- 중지: 해당 Actions 페이지의 Disable workflow
- 수동 실행과 배포 상태 확인 용도로 사용한다.

## 무료 플랜의 범위

Render 무료 웹 서비스는 외부 요청이 15분 동안 없으면 절전되며 다음 요청 때 로딩 화면을 표시한다. 5분 주기 외부 요청은 이 유휴 절전을 줄이는 용도다. 무료 서비스의 임의 재시작, 배포, 외부 스케줄러 장애 및 월별 한도는 요청만으로 제거되지 않으므로 항상 즉시 응답을 보장한다고 안내하지 않는다.

근거: [Render 무료 플랜](https://render.com/docs/free), [GitHub 예약 실행](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule), [cron-job.org FAQ](https://cron-job.org/en/faq/).

## 2026-10-15 재점검 상태

로그인 후 기존 작업 8534467이 **비활성화**된 것을 확인했습니다. URL과 매 5분 일정(Asia/Seoul), 응답 저장 옵션은 유지되어 있습니다. 목록의 마지막 실행은 2026-10-01 `Failed (HTTP error)` / 1.08초이며 상세 History는 `No history items found`입니다. 따라서 마지막 HTTP 코드와 비활성화 원인은 현재 보존 기록에서 확인할 수 없습니다. 위의 활성화·실행 성공은 2026-09-29 당시 기록입니다.

중복 작업은 만들지 않았습니다. 사용자의 명시적 승인 후 기존 작업을 재활성화하고 저장·새로고침으로 유지되는 것을 확인했습니다. 2026-10-15 11:20:46 한국 시간 test run은 HTTP 200, 539ms, `status: ok`, `database: connected`였습니다. 첫 자동 실행은 예약 11:20:00 → 실행 11:20:37(지연 37.51초), 578ms, HTTP 200으로 성공했습니다. 두 번째 자동 실행도 예약 11:25:00 → 실행 11:25:10(지연 10.96초), 974ms, HTTP 200 성공입니다. 연속 예약 간격은 5분, 실제 실행 간격은 약 4분 33초이며 이후 모든 실행의 정시 성공을 보장하지 않습니다. 공개 API 연결 성공만으로 cron 복구 완료로 처리하지 않습니다.

### 2026-10-15 점검 경로 분리

`a56f971` 수동 배포의 첫 시도는 프로세스 시작 로그 없이 15분 timeout으로 실패했고, 같은 커밋 재시도는 49.9초에 성공했다. `/api/health/live`의 웹 전용 응답을 공개 URL에서 확인했다. 기존 cron 8534467의 활성화·5분 간격은 유지하며 URL만 `/api/health/live`로 변경했고, 13:31 KST 테스트 응답은 `{status:"ok",service:"web"}`였다. Render의 실제 Health Check Path도 동일 경로로 저장했으며 변경으로 재배포가 시작됐다. 기존 `/api/health`는 DB 준비 상태 확인용으로 유지한다.
