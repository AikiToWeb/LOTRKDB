# Render 무료 서비스 접속 유지

GitHub Actions의 `Check Render availability` 작업이 약 5분마다 공개 `/api/health`에 요청하고 HTTP 200 및 PostgreSQL 연결 상태를 검사합니다. 홈페이지 전체와 카드 이미지를 다운로드하지 않아 요청량을 줄입니다. 계정이나 비밀 키가 필요하지 않으며 사용자 덱과 기록을 변경하지 않습니다. 요청은 외부 GitHub 실행기에서 발생하므로 Render 서버나 사용자의 PC가 켜져 있어야 하는 자체 타이머에 의존하지 않습니다.

- 설정: `.github/workflows/render-availability.yml`
- 실행 내역 및 수동 실행: https://github.com/AikiToWeb/LOTRKDB/actions/workflows/render-availability.yml
- 중지: 해당 Actions 페이지의 메뉴에서 Disable workflow 선택
- 초기 실행: 이 워크플로 파일을 main에 push할 때 즉시 검사

Render 무료 웹 서비스는 요청이 15분 동안 없으면 절전됩니다. 정기 상태 확인 요청은 유휴 절전을 줄이지만 항상 즉시 접속을 보장하지 않습니다. GitHub 예약 실행은 지연되거나 누락될 수 있고, 공개 저장소에 60일 동안 활동이 없으면 예약 작업이 자동 비활성화됩니다. 비활성화 시 Actions 화면에서 다시 활성화해야 합니다. 무료 플랜의 재시작, 배포, 월별 할당량 소진도 이 작업으로 방지하지 못합니다.

Render 무료 실행 시간은 워크스페이스 전체 월 750시간입니다. 서비스 하나를 계속 실행하면 월 720~744시간을 사용하므로 다른 무료 웹 서비스와 시간을 공유할 경우 한도를 확인해야 합니다. 무료 PostgreSQL의 생성 후 30일 만료는 접속 유지로 연장되지 않습니다. 상시 접속 보장이 필요하면 절전 없는 유료 인스턴스 또는 다른 호스팅 구성이 필요합니다.

근거: [Render 무료 플랜](https://render.com/docs/free), [GitHub 예약 실행 조건](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule).
