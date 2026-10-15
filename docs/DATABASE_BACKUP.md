# PostgreSQL 전체 백업과 만료 대응

## 2026-10-15 확인 결과

- 원격 main: `8bc49e93cd2e5390c0852f322f76f3c9c2fe73ef`.
- 공개 배포 자동 검증: PostgreSQL 연결, 계정별 기록 저장·재로그인·격리 통과. 공동 방 두 계정 참여·덱 등록·준비·시작·종료 통과.
- Render Info의 만료 시각: **2026-10-28 14:37:05.707222 Asia/Seoul** (`2026-10-28T05:37:05.707222Z`). 생성 시각은 2026-09-28 14:37:05.707222 Asia/Seoul이다.
- 현재 기존 DB는 Free / PostgreSQL 18 / Singapore / `available`, 1 GB 중 6.71% 사용으로 확인했다. 외부 PostgreSQL inbound 규칙은 비어 있고, 모든 외부 접속 차단 안내가 표시된다.
- Recovery: Free는 PITR 및 Create export 사용 불가, export 목록 0개. 기존 데이터는 접근 가능한 상태지만 전체 행 수·무결성과 복원 가능성은 아직 검증하지 않았다.
- Plan: 최소 유료 compute `0.1c-256mb`는 월 **US$6**로 표시된다. storage·세금 등 포함 최종 청구액은 확인 전이며 플랜을 저장하지 않았다.
- 기존 웹 서비스의 Auto-Deploy는 **On Commit**, live 커밋은 `8c6f422`였다. 이후 `8bc49e9`까지는 문서·스케줄러 변경이며 앱 기능 차이는 없다. 푸시 후 실제 배포 트리거를 검증해야 한다.
- cron 8534467: **비활성화**. 5분 일정·Asia/Seoul·health URL은 유지된다. 목록의 마지막 실행은 2026-10-01 HTTP error / 1.08초, History는 `No history items found`. 당시 상세 HTTP 코드와 비활성화 원인은 확인할 수 없다.
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
