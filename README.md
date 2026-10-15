# 서부의 기록 · LOTRKDB

Fantasy Flight Games의 **The Lord of the Rings: The Card Game (LCG)**만 다루는 한국어 웹 애플리케이션입니다. 다른 반지의 제왕 게임이나 TCG를 포함하지 않습니다.

## 구현 기능

- 카드 DB: 한국어/영어 이름·특성·효과·번호 검색, 영역·유형·제품·비용·고유·정오표 필터, 표/이미지 보기, 카드 이미지 옆 한국어 효과와 영문 원문, 재수록 제품 표시.
- 덱: 영웅·동료·부착·이벤트·부가 퀘스트 편집, 기본 구성 검사, 영웅 위협 합산, 메모, JSON 내보내기/가져오기, RingsDB 공개 덱 가져오기.
- 시나리오: 검색, 제품/승리 여부 필터, 조우 세트·모드별 정보 조회, 도전/승리 집계.
- 플레이 기록: 덱·캠페인 연결, 1~4인, 쉬움/일반/악몽, 진행 중/승리/패배, 날짜·라운드·위협·피해·승점·메모, 점수 계산.
- 캠페인: 시나리오 선택, 해당 캠페인의 승리 집계, 은혜·부담·메모.
- 보유 제품: 개정판 등 재수록 제품을 포함한 소유 카드 필터.
- 저장: Render 서버의 자체 회원가입(이름·아이디·비밀번호) 및 아이디 로그인, 계정별 PostgreSQL 저장, 개인 기록 JSON 백업/복원(계정·공동 방 제외). SNS 연동이나 이메일 입력은 필요하지 않습니다. 기존 Supabase 연결도 선택적으로 지원합니다.
- 반응형 PC/모바일 화면, 키보드 접근 가능한 모달, 홈 화면 추가용 웹 앱 manifest.

초기 스냅샷: 카드 **1,315장**, 제품 **114개**, 시나리오 **143개** (2026-09-28). RingsDB에 공개된 커뮤니티 콘텐츠도 포함되어 있으므로 제품 필터로 범위를 좁힐 수 있습니다. 전체 카드 효과의 한국어 번역을 제공하며 **101종 검수 / 1,214종 자동 번역**을 구분합니다. 공개 팬 번역 자료에서 확인한 **31종 한글 카드 이미지**를 적용했습니다. 공식 한국어판으로 표기하지 않습니다. [번역 및 이미지 출처](docs/KOREAN_CARDS.md)를 확인하세요.

## 로컬 실행

Node.js 22 이상 권장.

```sh
npm ci
npm run dev
```

개발 주소는 `http://127.0.0.1:5173`입니다.

```sh
npm test
npm run build
npm run preview
```

## 현재 배포: Render Web Service + Render PostgreSQL

**공개 사이트:** [https://lotrkdb.onrender.com](https://lotrkdb.onrender.com)

2026-09-28 실제 Render 배포와 PostgreSQL 저장 테스트를 완료했습니다. [배포 테스트 결과](docs/DEPLOYMENT_TEST.md)를 확인하세요. 사이트에서 회원가입 후 로그인하면 모바일/PC에서 같은 계정의 기록을 불러올 수 있습니다.

사용자가 요청한 Render DB 테스트 구성입니다. 기존 싱가포르 웹 서비스 `lotrkdb`와 PostgreSQL `lotrkdb-postgres`를 유지합니다. `render.yaml`은 해당 구성의 기준이며 중복 서비스를 만들지 않습니다.

1. [기존 웹 서비스](https://dashboard.render.com/web/srv-dasvq9g473hc73e52a10)에서 저장소·main·자동 배포 연결 상태와 배포 커밋을 확인합니다.
2. [기존 DB](https://dashboard.render.com/d/dpg-dasvq08473hc73e518ig-a)에서 만료 시각과 보존 상태를 확인합니다. DB URL은 서버 환경에서만 사용합니다.
3. 코드 변경은 기존 서비스에 배포하고 `/api/health` 및 배포 검증을 실행합니다.
4. 무료 DB 만료 대응은 [전체 DB 백업·이전 절차](docs/DATABASE_BACKUP.md)를 따릅니다. 앱 JSON만으로 공동 방이나 계정을 복구할 수 없습니다.

빌드 명령: `npm ci --include=dev && npm run build`. 시작 명령: `npm start`.

정기 접속 유지는 DB를 조회하지 않는 `/api/health/live`를 사용합니다. `/api/health`는 수동 PostgreSQL 연결 검사와 배포 검증용입니다. 무료 외부 DB의 휴면·사용량을 보존하기 위해 두 검사를 구분합니다. Neon Free 이전 준비와 전체 운영 백업 도구는 [백업 문서](docs/DATABASE_BACKUP.md)를 참조하세요.

| 서버 환경변수           | 설정                                                                                                             |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`          | Blueprint가 Render Postgres 내부 연결로 자동 설정                                                                |
| `NODE_ENV`              | `production`                                                                                                     |
| `VITE_STORAGE_PROVIDER` | `render`                                                                                                         |
| `APP_ORIGIN`            | 기본 Render 주소에서는 생략 가능 (`RENDER_EXTERNAL_URL` 사용). 사용자 도메인을 쓰면 정확한 HTTPS origin으로 설정 |

### 무료 테스트 조건

- Render 무료 PostgreSQL은 생성 후 **30일에 만료**됩니다. 만료 전에 전체 PostgreSQL 백업을 확보하고 복원 검증을 완료하세요. 앱 JSON은 개인 기록만 포함합니다.
- 무료 웹 서비스는 15분 동안 사용하지 않으면 대기 상태가 되고 재접속 때 시작 시간이 걸릴 수 있습니다.
- Render 자체 가입은 이름·아이디·비밀번호만 받으며 이메일·전화번호·SNS를 수집하거나 연결하지 않습니다. 아이디는 영문·숫자·밑줄 3~24자, 비밀번호는 8~128자입니다. 기존 이메일 계정은 아이디 칸에 기존 이메일을 입력하면 같은 계정으로 로그인합니다. 이메일을 통한 비밀번호 재설정은 제공하지 않습니다.
- 비밀번호는 무작위 salt를 붙여 scrypt로 해시합니다. 세션은 PostgreSQL에 토큰 해시로 저장하고, 브라우저에는 HttpOnly·SameSite=Lax·Secure 쿠키만 저장합니다.
- 인증 API에 요청 제한을 적용합니다. 데이터 쓰기는 동일 사이트 Origin을 확인하고, DB 쿼리는 세션 사용자 ID에 한정합니다. 다른 탭에서 계정이 바뀌면 쓰기/읽기를 거부합니다.
- 덱, 플레이, 캠페인, 보유 목록의 변경은 DB 트랜잭션으로 반영합니다.
- public repository URL 연결은 Render GitHub 앱에 저장소를 추가하지 않아도 테스트할 수 있지만 자동 배포 기능이 제한될 수 있습니다. 이후 변경은 Blueprint/서비스에서 수동 배포합니다.

### 서버 로컬 실행

`.env.local`에 `VITE_STORAGE_PROVIDER=render`, 테스트 PostgreSQL의 `DATABASE_URL`, `APP_ORIGIN=http://127.0.0.1:5173`을 설정합니다.

```sh
npm run dev:server
# 다른 터미널
npm run dev
```

Vite가 `/api`를 로컬 3001번 서버로 전달합니다. Render 배포에서는 같은 Node 서버가 API와 빌드된 화면을 함께 제공합니다.

### 서버 테스트

`npm test`는 비밀번호 해시, 인증/Origin 경계, 기록 변경 계산과 기존 도메인 테스트를 실행합니다. `TEST_DATABASE_URL`이 있을 때 실제 PostgreSQL에서 가입, 세션 쿠키, 사용자별 기록 격리, 변경/삭제, 다른 기기의 관계없는 기록 보존, 잘못된 기록 거부, 로그아웃과 재로그인을 검증합니다. GitHub Actions는 임시 PostgreSQL 16 서비스를 생성해 이 통합 테스트를 실행합니다.

```sh
npm run test:deployment -- https://lotrkdb.onrender.com
```

실제 배포를 대상으로 임시 테스트 계정 두 개를 만들고 저장/조회/재로그인/계정 격리를 검증합니다. 완료 후 임시 덱·플레이·캠페인·보유 기록과 세션을 정리합니다. 빈 테스트 계정 두 개는 DB에 남으며 실제 이메일을 발송하지 않습니다. 앱 이용자의 기존 기록을 수정하지 않습니다.

## 다른 PostgreSQL로 이전할 때

현재 운영은 Render 자체 인증과 PostgreSQL을 사용합니다. 저장소에 남은 Supabase 어댑터는 별도 대체 구성이며 현재 계정·공동 방을 자동으로 옮기지 않습니다. DB 만료 대응을 위해 새 Static Site나 중복 웹 서비스를 만들지 마세요. 기존 웹 서비스와 자체 인증을 유지하는 PostgreSQL 백업·복원 방법은 [전체 DB 백업·이전 절차](docs/DATABASE_BACKUP.md)를 확인하세요.

## 저장과 동기화 정책

- 비로그인 사용자는 카드 조회만 이용합니다. 덱·기록·캠페인·공동 방은 로그인 후 사용합니다.
- 사용자 기록은 PostgreSQL에 저장합니다. DB 쓰기 성공 후에만 화면을 갱신하고 저장 완료를 표시하며, 실패하면 편집 입력과 이전 저장 상태를 유지합니다.
- 예전 로컬 기록·미동기화 큐는 이관 목적으로만 읽습니다. 새 사용자 기록이나 실패한 변경을 localStorage에 저장하지 않습니다.
- 개별 기록의 변경만 반영하므로 다른 기기의 관계없는 기록을 지우지 않습니다. 같은 기록을 동시에 수정하면 마지막 저장이 적용됩니다.
- 개인 JSON 복원은 현재 계정 기록과 병합하며 같은 ID는 현재 기록을 유지합니다. 공동 방과 계정은 복원하지 않습니다.
- 운영 백업에는 계정 UUID·비밀번호 해시와 공동 방 관계까지 포함해야 합니다. [백업 범위와 이전 절차](docs/DATABASE_BACKUP.md)를 확인하세요.

## 데이터 갱신

```sh
npm run data:sync
```

RingsDB의 공개 `cards/`, `packs/` API와 공개 저장소의 시나리오 목록을 가져와 `public/data/catalog.json`에 스냅샷을 저장합니다. 시나리오 SQL을 실행하지 않고 VALUES 데이터만 파싱합니다. 모든 필수 데이터가 정상적으로 수신된 뒤 스냅샷을 교체하므로 실패 시 기존 DB를 유지합니다. 매 페이지 요청이나 빌드마다 upstream을 불필요하게 호출하지 않습니다.

시나리오 조우 세트와 공개 덱 가져오기는 브라우저에서 해당 공개 API를 호출합니다. 요청 실패 시 사용자에게 오류를 표시합니다. 시나리오 목록 자체는 upstream 공개 SQL 스냅샷에 따라 갱신됩니다. 카드 이미지는 RingsDB에서 직접 제공받아 이미지가 없거나 실패하면 카드 이름을 표시합니다.

## 덱/점수 검사 범위

일반 덱의 영웅 수, 같은 이름의 영웅 중복, 카드별 수량, 최소 50장을 확인합니다. 미완성 덱도 저장할 수 있습니다. 계약, 보물, 배긴스/원정대 영웅, 특수 시나리오 예외의 완전한 규칙 엔진은 아닙니다. 영웅 위협은 인쇄된 위협 값의 합계이며 카드 능력이나 캠페인 보정이 적용되지 않습니다.

승리 점수는 `완료한 라운드 × 10 + 최종 위협 합계 + 생존 영웅 피해 합계 + 사망 영웅 위협 합계 − 승점 합계`로 계산합니다. 다인 플레이는 모든 플레이어의 합산 값을 입력합니다.

## 검증

- TypeScript 검사와 production build.
- 도메인 테스트: 일반 덱 구성, 영웅 중복, 수량 제한, 백업 검증, 점수 공식, upstream SQL 파싱.
- 브라우저 검증: 카드 검색, 영웅 제한, 덱 저장 후 새로고침 유지, 시나리오 화면 및 모바일 배치.
- Render 운영 검증은 `npm run test:deployment -- https://lotrkdb.onrender.com`과 `node scripts/smoke-rooms.mjs https://lotrkdb.onrender.com`으로 실행합니다. 실제 브라우저의 로그인·저장·방 참여도 별도로 확인합니다.

## 출처 및 권리

- [RingsDB API 안내](https://ringsdb.com/api/) / [API 문서](https://ringsdb.com/api/doc)
- [RingsDB 공개 저장소](https://github.com/seastan/ringsdb)
- [Render 무료 서비스 정책](https://render.com/docs/free)
- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)

카드 원문과 이미지의 권리는 Fantasy Flight Games 및 각 권리자에게 있습니다. RingsDB의 카드 데이터와 이미지는 Hall of Beorn을 참조합니다. 이 앱은 비공식 팬 프로젝트이며 Fantasy Flight Games의 제작·보증·지원·제휴를 받지 않습니다.

### 현재 무료 운영 DB

2026-10-15 기존 Render 웹 서비스를 유지한 채 전체 PostgreSQL 데이터를 Neon Free로 이전하고 복원·로그인·저장·공동 방을 검증했습니다. 서버 전용 `DATABASE_URL`은 Render 대시보드에서 관리합니다. 원본 Render DB는 보존하지만 2026-10-28 만료 예정이며 현재 운영은 Neon을 사용합니다. 자세한 백업·검증·무료 한도는 [DB 백업 문서](docs/DATABASE_BACKUP.md)를 참고하세요.
