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
