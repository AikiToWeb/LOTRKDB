# PostgreSQL 전체 백업과 만료 대응

## 2026-10-15 확인 결과

- 최초 점검 시 원격 main: `8bc49e93cd2e5390c0852f322f76f3c9c2fe73ef`.
- 공개 배포 자동 검증: PostgreSQL 연결, 계정별 기록 저장·재로그인·격리 통과. 공동 방 두 계정 참여·덱 등록·준비·시작·종료 통과.
- Render Info의 만료 시각: **2026-10-28 14:37:05.707222 Asia/Seoul** (`2026-10-28T05:37:05.707222Z`). 생성 시각은 2026-09-28 14:37:05.707222 Asia/Seoul이다.
- 현재 기존 DB는 Free / PostgreSQL 18 / Singapore / `available`, 1 GB 중 6.71% 사용으로 확인했다. 외부 PostgreSQL inbound 규칙은 비어 있고, 모든 외부 접속 차단 안내가 표시된다.
- Recovery: Free는 PITR 및 Create export 사용 불가, export 목록 0개. 기존 데이터는 접근 가능한 상태지만 전체 행 수·무결성과 복원 가능성은 아직 검증하지 않았다.
- Plan: 최소 유료 compute `0.1c-256mb`는 월 **US$6**로 표시된다. storage·세금 등 포함 최종 청구액은 확인 전이며 플랜을 저장하지 않았다.
- 기존 웹 서비스의 Auto-Deploy는 **On Commit**, live 커밋은 `8c6f422`였다. 이후 `8bc49e9`까지는 문서·스케줄러 변경이며 앱 기능 차이는 없다. 푸시 후 실제 배포 트리거를 검증해야 한다.
- 최초 점검 시 cron 8534467: **비활성화**(이후 승인받아 복구, 아래 기록 참조). 5분 일정·Asia/Seoul·health URL은 유지된다. 목록의 마지막 실행은 2026-10-01 HTTP error / 1.08초, History는 `No history items found`. 당시 상세 HTTP 코드와 비활성화 원인은 확인할 수 없다.
- 운영 DB 백업 파일은 아직 확보하지 않았다. API 연결 성공은 전체 데이터 보존이나 백업 완료의 증거가 아니다.

## 앱 JSON의 정확한 범위

`src/App.tsx`는 `{version, exportedAt, state}`를 다운로드한다. `src/domain.mjs`의 `validateState`는 decks, plays, campaigns, owned만 복원한다. `server/database.mjs`의 계정 state도 이 네 종류만 읽는다.

| 대상                                   | 개인 JSON | 전체 DB dump |
| -------------------------------------- | --------- | ------------ |
| 현재 계정의 덱·플레이·캠페인·보유 제품 | 포함      | 포함         |
| 계정 UUID·아이디·이름·비밀번호 해시    | 제외      | 포함         |
| 공동 방·초대 코드·방장·진행 상태       | 제외      | 포함         |
| 참가자·방 등록 덱 snapshot·준비 상태   | 제외      | 포함         |
| 개인 방 숨김 상태 `deleted_at`         | 제외      | 포함         |
| 세션·카탈로그                          | 제외      | 포함         |

개인 JSON을 새 계정에 복원해도 기존 방장·참여자 관계를 복구하지 못한다. 이전에는 이름이 ‘전체 백업’이었지만 전체 DB 백업이 아니다.

## 만료 전 실행 순서

1. 기존 DB `dpg-dasvq08473hc73e518ig-a`의 Info에서 정확한 만료 시각·시간대·플랜·PostgreSQL 버전·상태를 기록한다. 접속 URL이나 비밀번호는 문서·채팅·스크린샷에 넣지 않는다.
2. 만료보다 충분히 앞서 전체 dump와 별도 빈 DB 복원 시험을 끝낸다. 현재 확인된 만료일까지 기다리지 말고 백업 접근 방법을 먼저 확정한다.
3. 무료 DB는 Render 관리 백업/PITR을 지원하지 않는다. 접근 가능한 신뢰된 환경에서 `pg_dump`를 사용한다. 현재 웹 서비스도 Free이면 Render Shell은 제공되지 않는다.
4. 외부 접속이 차단되어 있으면 먼저 대안을 정한다. 외부 접근을 열어야 하는 경우 필요한 작업자 IP만 일시 허용하고 백업 직후 원래 차단 상태로 복구한다. `0.0.0.0/0` 전체 허용을 사용하지 않는다. 접근 변경과 유료 전환은 별도 검토 후 실행한다.

### 논리 백업

서버와 같거나 더 최신인 PostgreSQL major 버전의 `pg_dump`를 사용한다. 점검 PC의 기본 클라이언트는 14.12이므로 실제 서버 버전 확인 전에는 호환된다고 가정하지 않는다.

접속은 libpq 환경변수 `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGSSLMODE=verify-full`와 권한 0600의 `PGPASSFILE`로 구성한다. 비밀번호·URL을 명령 인자나 shell history에 넣지 않는다. 공급자 CA가 필요하면 `PGSSLROOTCERT`로 지정한다. 저장소 밖의 보호된 폴더에서 실행한다.

```sh
umask 077
pg_dump --format=custom --no-owner --no-acl --file=lotrkdb-full.dump
pg_restore --list lotrkdb-full.dump > lotrkdb-full.contents
shasum -a 256 lotrkdb-full.dump > lotrkdb-full.dump.sha256
```

dump는 계정 해시·세션·사용자 기록을 포함하는 민감 자료다. 암호화된 별도 저장소에 복사하고 Git·공개 파일·웹 서비스의 임시 디스크에 보관하지 않는다. 파일 크기나 목록 검사만으로 복원 성공으로 판단하지 않는다.

### 별도 빈 DB에서 복원 시험

운영 DB를 대상으로 실행하지 않는다. 별도 비운영 DB의 libpq 연결 설정으로 바꾼 뒤:

```sh
pg_restore --exit-on-error --single-transaction --no-owner --no-acl \
  --dbname="$PGDATABASE" lotrkdb-full.dump
```

원본과 복원본에서 `lotr_users`, `lotr_documents`(kind별), `lotr_catalog`, `lotr_rooms`(상태별), `lotr_room_members`(숨김 여부별)의 건수와 ID·관계를 비교한다. 원본 비교값은 dump와 같은 snapshot 또는 쓰기가 멈춘 시점 기준으로 확보한다. 기존 계정 로그인·덱 조회·방장 권한·참여자·등록 덱·숨김/복원을 시험한다. 모든 UUID와 비밀번호 해시를 유지해야 기존 로그인이 유지된다. 이 문서는 복원 시험의 완료 기록이 아니다.

## 유료 전환과 외부 PostgreSQL 이전

- 기존 Render DB의 compute plan을 유료로 바꾸는 방식은 기존 DB를 유지하는 경로다. 최종 가격은 대시보드의 compute·storage·세금 등 견적을 확인해 승인받는다. workspace 유료화만으로 Free DB 만료가 해제되지 않는다. 전환 중 연결 중단 가능성과 백업 상태를 확인한다. 현재 대시보드 최소 compute는 US$6/월이며 총 청구액은 아직 미확인이다.
- 외부 PostgreSQL로 이전하면 호환 dump를 복원해 자체 아이디·비밀번호 해시·UUID·공동 방을 유지할 수 있다. 외부 DB의 요금·저장/트래픽·휴면·만료·백업·리전·TLS 조건을 확인한다. 기존 웹 서비스의 서버 전용 `DATABASE_URL`만 바꾸며 별도 웹 서비스를 만들지 않는다. Blueprint가 기존 DB 참조를 다시 적용하지 않도록 `render.yaml`과 환경 설정도 함께 조정한다.
- Supabase Auth로 바로 전환하는 것은 단순 PostgreSQL 이전과 다르다. 현재 자체 인증의 scrypt 해시·계정 UUID·공동 방 관계가 자동 이관되지 않는다. 기존 Supabase 대체 배포 문서를 무손실 이전 절차로 사용하지 않는다.
- 최종 이전 시 원본 쓰기를 중지하고 마지막 dump·복원·검증 후 연결을 전환한다. 구 DB는 검증이 끝나기 전 삭제하지 않는다. 새 DB에서 쓰기가 시작된 뒤 구 DB로 되돌리면 새 변경이 유실되므로 rollback 전에 데이터 대조가 필요하다. 전환 후 배포 자동 검증과 실제 브라우저 로그인·저장·방 참여를 재검증한다.

## 공급자 정책 근거

2026-10-15 확인한 [Render 무료 정책](https://render.com/docs/free): 생성 30일 후 Free DB 접근 중지, 이후 14일 유예 안에 유료 전환 가능, 그 뒤 데이터 삭제. **유예 기간은 무료 읽기·내보내기 기간이 아니다.** 무료 웹의 15분 유휴 절전·재시작과 DB 점검은 5분 health 요청으로 완전히 제거할 수 없다.

[Render 백업 문서](https://render.com/docs/postgresql-backups)는 Free DB의 로컬 `pg_dump`를 안내한다. [가격표](https://render.com/pricing)와 실제 대시보드 견적을 확인한 뒤 비용을 결정한다.

## 무료 운영 선택 (2026-10-15)

사용자는 유료 플랜을 사용하지 않기로 결정했다. Render 유료 전환·결제·유료 서비스 생성은 진행하지 않는다. 기존 웹 서비스는 유지하고, 만료 전에 무료 PostgreSQL로 이전하는 방향으로 준비한다.

후보는 Neon Free이다. 2026-10-15 [공식 플랜 문서](https://neon.com/docs/introduction/plans)의 한도는 프로젝트당 DB 1 GB, 월 100 CU-hours, 공개 네트워크 전송 5 GB이며 5분 비활동 후 compute가 휴면한다. 한도는 공급자가 변경할 수 있으므로 실제 생성 화면에서 Free/$0를 다시 확인한다. 기존 계정이 있으면 먼저 적합한 프로젝트를 확인하고 중복 프로젝트를 만들지 않는다. 새 계정의 가입·약관은 사용자가 직접 처리한다. 이 문서는 Neon 생성·이전·원본 데이터 전송 승인이나 완료 기록이 아니다.

전체 계정·공동 방을 보존하는 절차는 PostgreSQL 18 호환 `pg_dump` → 보호된 로컬 보관 → 별도 빈 DB 복원·관계/로그인 검증 → 짧은 쓰기 중지·최종 dump → 기존 Render 서버의 `DATABASE_URL` 전환이다. Neon Auth로 바꾸지 않으며, scrypt 해시와 기존 UUID를 유지한다. 외부 DB는 TLS 인증서 검증을 유지한다. DB 접근 규칙 변경은 필요한 작업자 IP 하나(/32)에 한해 별도 승인 후 잠시 허용하고 원복한다. URL은 채팅·명령 인자·소스에 기록하지 않는다.

현재 로컬 `pg_dump`는 14.12로 운영 PostgreSQL 18의 백업에 사용할 수 없다. Homebrew의 클라이언트 조회도 로컬 Xcode 라이선스 미동의 오류로 중단됐다. 자동으로 라이선스에 동의하지 않았으며, 백업 실행 전에 호환 클라이언트와 접근 경로를 확보해야 한다. 당시 실제 운영 dump는 없었다. 이후 호환 클라이언트를 준비해 아래 운영 백업 검증을 완료했다.

### 휴면과 5분 점검의 충돌

현재 `/api/health`는 PostgreSQL에 연결한다. Render의 지속적인 health check와 cron의 5분 호출을 그대로 외부 휴면 DB에 연결하면 DB를 계속 깨울 수 있다. 예를 들어 0.25 CU를 한 달 24시간 유지하면 약 180 CU-hours로, 위의 100 CU-hours를 넘는다. 무료 이전 시 웹 프로세스 생존 확인(DB 쿼리 없음)과 DB 준비 상태 검사를 분리하고, cron·Render health check가 생존 확인만 호출하도록 먼저 수정·검증한다. 계정 API 실패는 계속 명확히 표시하며 DB 장애를 정상 저장으로 처리하지 않는다. 현재는 Render DB를 사용하므로 기존 health URL과 5분 일정을 그대로 유지한다.

가입/이전 대상 선택, 원본 접근 승인, 클라이언트 준비, 전체 백업, 복원 시험, 최종 연결 전환은 아직 남아 있다. 수정 앱 `4c20b8c`의 기존 서비스 수동 배포와 배포 후 API/브라우저 검증은 완료했다. cron 재활성화와 연속 자동 실행 두 회의 HTTP 200도 확인했다. 무료 운영은 절전·첫 접속 지연을 허용하며 무중단이나 영구 무료 보존을 보장하지 않는다.

## Neon Free 이전 준비 결과

- 사용자 승인 후 전용 이전 대상 `LOTRKDB`를 생성했다. 기존 `TCG BOBUSANG` 프로젝트는 변경하지 않았다.
- 프로젝트 ID: `patient-dust-07374681`, 기본 branch: `production` / `br-steep-bread-azytnz06`.
- 실제 화면에서 **Free plan**, AWS Singapore, PostgreSQL **18**, DB `lotrkdb`, 단일 compute를 확인했다. Neon Auth·Object storage·Functions·AI gateway는 활성화하지 않았다. 데이터·운영 연결은 아직 이전하지 않았다.
- PostgreSQL 18.6 공식 Homebrew 사전 빌드 패키지와 의존성을 SHA256 검증 후 임시 폴더에 준비했다. Xcode 라이선스에 자동 동의하지 않았다. 별도 로컬 PostgreSQL 18에서 복원 검증을 수행했으며 이 로컬 서버는 시험 후 종료한다.

### 운영 전체 백업 도구

`node scripts/backup-database.mjs backup /절대경로/새-보호폴더`는 서버 DB URL을 **로컬 터미널의 숨김 입력**으로 받는다. 채팅·소스·명령 인자에 URL을 넣지 않는다. `PG_BIN_DIR`에 서버 major 이상인 PostgreSQL 클라이언트 폴더를 지정할 수 있다. `BACKUP_DATABASE_URL`은 자동화용 프로세스 환경에서만 선택적으로 사용하며 출력하지 않는다.

- 원격 DB TLS는 인증서 검증을 유지한다. CA 기본 경로는 macOS `/etc/ssl/cert.pem`이며 다른 OS에서는 `PGSSLROOTCERT`로 신뢰 CA를 지정한다.
- 원본은 repeatable-read/read-only 트랜잭션으로 읽고, 같은 export snapshot을 `pg_dump`에 전달한다. 계정·비밀번호 해시·세션·개인 기록·공동 방·참가자·등록 덱·숨김 상태를 포함하는 DB 전체 아카이브를 만든다. 서버 전역 role/접속 자격증명과 소유권·ACL은 이관하지 않는다.
- 새 폴더만 허용하고 권한은 0700, 파일은 0600으로 저장한다. 결과는 `database.dump`, `contents.txt`, `manifest.json`이다. manifest에는 같은 시점의 테이블 건수·데이터 SHA256·dump SHA256을 저장하며 연결 URL은 저장하지 않는다.
- `restore-local /백업폴더`는 loopback의 **빈 DB에서만** 전체 트랜잭션 복원을 허용한다. `verify /백업폴더`는 대상 DB를 읽기만 하여 모든 테이블의 건수·데이터 지문을 비교한다. 아카이브 체크섬이 다르면 거부한다. `local-restore-verification.json` 또는 `verification.json`이 성공 증거이며 파일 목록 검사만으로 복원 완료로 판단하지 않는다.
- 이 운영 도구의 아카이브는 앱 개인 JSON 가져오기로 복원할 수 없다. 민감한 계정 해시·세션을 포함하므로 장기 보관본은 암호화된 별도 위치에 복사한다.

로컬 합성 데이터(계정 2개·공동 방 1개·참가자 2개·각자의 덱 snapshot·세션·보유 제품·숨긴 방 상태·microsecond timestamp)를 전체 백업해 PostgreSQL 18에 복원했고 **6개 테이블의 건수와 데이터 지문이 모두 일치**했다. 비어 있지 않은 대상에 대한 재복원은 거부했으며 이후 데이터 지문도 유지됐다. **이 결과는 운영 DB의 백업·복원 성공 기록이 아니다.**

### 운영 백업 접근 시도와 남은 단계

사용자가 승인한 현재 PC IP 하나(/32)만 Render DB에 잠시 허용했다. 접속 URL을 채팅에 노출하지 않는 일회용 loopback 입력 도구를 준비했으나 Chrome이 폼 전송을 `ERR_BLOCKED_BY_CLIENT`로 차단하여 운영 백업은 시작되지 않았다. Terminal의 자동 제어도 도구 안전 제한으로 사용할 수 없었다. 제한을 우회하지 않았으며, 임시 IP 규칙 제거를 확정하고 새로고침 후 **모든 외부 트래픽 차단**을 확인했다. 일회용 입력 도구도 종료했다.

이 첫 접근 시도 당시에는 운영 dump가 없었고 사용자 전용 보호 폴더 `~/.local/share/lotrkdb-backups`만 준비되어 있다. 다음 실제 백업은 사용자가 로컬 터미널의 숨김 입력 도구를 직접 실행하는 방식 등 승인된 경로를 확보한 뒤 수행한다. 연결정보는 계속 채팅에 요청하거나 출력하지 않는다. 재접속을 위한 IP 규칙 변경은 실행 시점에 확인한다.

전체 운영 백업·로컬 복원 검증이 끝난 뒤 결과를 보고하고, Neon 데이터 전송 승인을 받아 복원한다. 최종 쓰기 중지·최신 백업·Neon 대조가 끝나기 전에는 Render의 `DATABASE_URL`을 바꾸거나 기존 DB를 삭제하지 않는다.

### 정기 상태 점검 분리

`/api/health/live`를 추가했다. `{status: "ok", service: "web"}`만 반환하고 DB를 조회하지 않는다. 기존 `/api/health`의 `{status: "ok", database: "connected"}`는 그대로 유지하여 배포 검증·수동 DB 점검에 사용한다. Render `healthCheckPath`, 기존 cron 8534467, 보조 GitHub Actions는 새 route의 배포 확인 후 생존 확인 URL로 전환한다. DB 준비 상태를 주기적으로 호출해서 Neon을 깨우지 않는다. 실제 운영 저장 API의 오류 처리는 유지한다.

### 실제 운영 백업 검증 완료 (2026-10-15 13:24 KST)

사용자가 숨김 입력 실행기로 전체 운영 백업을 완료했다. 실행기의 Node 경로 오류를 수정한 후 성공 결과와 파일을 함께 확인했다. 보호 폴더의 `render-20261015T042325Z` 백업을 새 빈 로컬 PostgreSQL 18 DB에 복원했으며 6개 테이블 모두 원본 스냅샷의 건수와 SHA256 데이터 지문이 일치했다. 계정 22, 문서 9, 방 8, 참가자 14, 세션 2, 카탈로그 1건이며 QA 계정과 방도 포함한다. 증거는 보호 폴더의 `local-restore-verification.json`이다. 임시 /32 접근은 제거하고 전체 외부 접속 차단을 확인했다.

사용자는 이 백업의 계정·비밀번호 해시·개인 기록·공동 방 정보를 기존 Neon Free LOTRKDB로 이전하고 기존 Render 웹 서비스의 연결을 전환하도록 승인했다. 아직 복원·전환 완료를 의미하지 않는다. `restore-neon`은 지정한 직접 연결 호스트와 `lotrkdb` DB만 허용하고, 검증된 백업·빈 대상·체크섬을 확인한 뒤 단일 트랜잭션으로 복원한다. 전체 데이터 지문이 일치해야 `neon-restore-verification.json`을 기록한다. 연결 URL은 로컬 숨김 입력으로만 처리한다.

### Neon 복원 검증 완료 (2026-10-15 13:34 KST)

사용자가 숨김 입력으로 승인된 Neon Free LOTRKDB에 복원했다. 로컬 증거 파일 `neon-restore-verification.json`의 dump 체크섬이 검증된 원본 백업과 일치하며, 6개 테이블의 모든 행 수와 데이터 지문이 일치한다. URL과 `psql 'URL'` 복사 형식을 허용하지만 붙여넣은 명령은 실행하지 않는다. 복원 전 대상 검증에서 실패한 시도는 전송되지 않았으며 이후 최종 복원이 성공했다.

이 시점의 운영 연결은 아직 Render 원본이다. 기존 웹 서비스의 환경변수 전환을 준비했고, 원본 DB 리소스는 보존한다. Blueprint가 다음 동기화 때 원본 DB 연결을 재주입하지 않도록 `DATABASE_URL`을 `sync: false`로 바꾼다. 연결정보는 대시보드 서버 비밀값으로만 관리한다.
