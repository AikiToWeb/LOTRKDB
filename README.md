# 서부의 기록 · LOTRKDB

Fantasy Flight Games의 **The Lord of the Rings: The Card Game (LCG)**만 다루는 한국어 웹 애플리케이션입니다. 다른 반지의 제왕 게임이나 TCG를 포함하지 않습니다.

## 구현 기능

- 카드 DB: 이름·특성·효과·번호 검색, 영역·유형·제품 필터, 페이지 이동, 카드 이미지와 영어 원문, 정오표, 재수록 제품 표시.
- 덱: 영웅·동료·부착·이벤트·부가 퀘스트 편집, 기본 구성 검사, 영웅 위협 합산, 메모, JSON 내보내기/가져오기, RingsDB 공개 덱 가져오기.
- 시나리오: 검색, 제품/승리 여부 필터, 조우 세트·모드별 정보 조회, 도전/승리 집계.
- 플레이 기록: 덱·캠페인 연결, 1~4인, 쉬움/일반/악몽, 진행 중/승리/패배, 날짜·라운드·위협·피해·승점·메모, 점수 계산.
- 캠페인: 시나리오 선택, 해당 캠페인의 승리 집계, 은혜·부담·메모.
- 보유 제품: 개정판 등 재수록 제품을 포함한 소유 카드 필터.
- 저장: 게스트 기기 저장, Render 서버의 이메일/비밀번호 가입·로그인, 계정별 PostgreSQL 저장, JSON 백업/복원. 기존 Supabase 연결도 선택적으로 지원합니다.
- 반응형 PC/모바일 화면, 키보드 접근 가능한 모달, 홈 화면 추가용 웹 앱 manifest.

초기 스냅샷: 카드 **1,315장**, 제품 **113개**, 시나리오 **143개** (2026-09-28). RingsDB에 공개된 커뮤니티 콘텐츠도 포함되어 있으므로 제품 필터로 범위를 좁힐 수 있습니다. 전체 카드의 공식 한국어 번역은 제공하지 않습니다. 일부 기본판 이름의 한국어 표기는 검색 보조용입니다.

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

사용자가 요청한 Render DB 테스트 구성입니다. `render.yaml`로 싱가포르의 무료 웹 서비스 `lotrkdb`와 무료 PostgreSQL `lotrkdb-postgres`를 함께 생성합니다.

1. Render Dashboard → New → Blueprint에서 `https://github.com/AikiToWeb/LOTRKDB`를 연결합니다.
2. 이름을 `lotrkdb`로 지정하고 `main`의 `render.yaml`을 적용합니다. 웹/DB 모두 `free` 플랜인지 확인합니다.
3. Render가 DB의 내부 접속 URL을 서버의 `DATABASE_URL`에 주입합니다. 브라우저에 DB 비밀번호를 전달하지 않습니다. DB 외부 접속은 차단합니다.
4. 서버가 시작할 때 `server/schema.sql`을 적용하고 RingsDB 스냅샷을 `lotr_catalog`에 저장합니다.
5. `/api/health`가 `{ "status": "ok", "database": "connected" }`를 반환하면 실제 사이트에서 가입, 로그인, 덱/플레이 저장과 재접속을 확인합니다.

빌드 명령: `npm ci --include=dev && npm run build`. 시작 명령: `npm start`.

| 서버 환경변수           | 설정                                                                                                             |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`          | Blueprint가 Render Postgres 내부 연결로 자동 설정                                                                |
| `NODE_ENV`              | `production`                                                                                                     |
| `VITE_STORAGE_PROVIDER` | `render`                                                                                                         |
| `APP_ORIGIN`            | 기본 Render 주소에서는 생략 가능 (`RENDER_EXTERNAL_URL` 사용). 사용자 도메인을 쓰면 정확한 HTTPS origin으로 설정 |

### 무료 테스트 조건

- Render 무료 PostgreSQL은 생성 후 **30일에 만료**됩니다. 만료 전에 앱의 전체 JSON 백업을 내려받으세요.
- 무료 웹 서비스는 15분 동안 사용하지 않으면 대기 상태가 되고 재접속 때 시작 시간이 걸릴 수 있습니다.
- 이메일 발송 서비스를 연결하지 않은 테스트 구성입니다. 가입 시 이메일 확인, 비밀번호 재설정/변경 메일은 제공하지 않습니다. 실제 개인정보나 다른 서비스와 같은 비밀번호를 테스트에 사용하지 마세요.
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

## 대체 배포: Render Static Site + Supabase

정적 앱을 Render에 배포하고 계정 인증·장기 저장은 Supabase에 연결합니다. Render의 무료 서버 파일시스템에 SQLite를 저장하지 않습니다. Render 무료 Postgres의 30일 만료도 피합니다. 무료 요금제의 사용량·휴면 정책은 각 공급자의 현재 조건을 따릅니다.

### 1. Supabase 설정

1. [Supabase](https://supabase.com/dashboard)에서 Free 프로젝트를 준비합니다.
2. SQL Editor에서 [`supabase/schema.sql`](supabase/schema.sql)을 **한 번** 실행합니다. 사용자 소유의 덱, 기록, 캠페인, 컬렉션만 접근할 수 있도록 RLS가 적용됩니다.
3. Authentication → Providers에서 Email을 활성화합니다. 이메일 확인 사용을 권장합니다.
4. Project Settings → API에서 Project URL과 **publishable 또는 anon 공개 키**를 확인합니다. `service_role` 또는 secret 키는 앱에 넣으면 안 됩니다.
5. `.env.example`을 `.env.local`로 복사해 두 값을 입력하면 로컬에서 계정 기능을 사용할 수 있습니다.

```dotenv
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_PUBLIC_KEY
```

### 2. Render 배포

저장소: [AikiToWeb/LOTRKDB](https://github.com/AikiToWeb/LOTRKDB)

이 대체 구성은 **New → Static Site**에서 수동으로 설정합니다. 현재 `render.yaml`은 위의 Render PostgreSQL 구성에 사용합니다. `VITE_STORAGE_PROVIDER`를 생략하고 두 Supabase 환경변수를 입력합니다.

| 항목                  | 값                                            |
| --------------------- | --------------------------------------------- |
| Branch                | `main`                                        |
| Build Command         | `npm ci && npm run build`                     |
| Publish Directory     | `dist`                                        |
| Environment Variables | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` |

SPA Rewrite: `/*` → `/index.html`. `render.yaml`에는 이미 포함되어 있습니다. 비어 있는 환경변수로도 게스트 모드는 배포할 수 있지만, **다른 기기 간 저장은 Supabase 연결 후 가능합니다.** Vite 환경변수는 빌드 때 포함되므로 연결 정보를 변경하면 재배포합니다.

### 3. 로그인 Redirect URL

배포 후 Supabase Authentication → URL Configuration에 다음을 설정합니다.

- Site URL: Render의 실제 `https://…onrender.com` 주소.
- Redirect URLs: 실제 배포 주소와 `http://127.0.0.1:5173/**` (로컬 개발용).
- 회원가입 확인과 비밀번호 재설정 링크가 실제 사이트로 돌아오는지 확인합니다.
- 기본 이메일 발송 제한을 넘어서는 사용량이라면 Supabase의 이메일 공급자 설정을 추가합니다.

### 4. 공개 배포 후 확인

1. PC에서 가입/이메일 확인/로그인 후 덱과 플레이를 저장합니다.
2. 모바일에서 같은 계정으로 로그인하여 기록이 보이는지 확인합니다.
3. 다른 계정에서는 첫 계정의 기록이 보이지 않는지 확인합니다.
4. 같은 계정의 여러 기기를 동시에 쓰는 경우 설정의 **계정 기록 새로고침**으로 최신 기록을 불러옵니다.
5. 백업 다운로드와 복원, 로그인 해제 시 게스트/계정 기록 분리를 확인합니다.

## 저장과 동기화 정책

- 게스트 기록은 현재 브라우저에만 저장합니다. 브라우저 데이터를 삭제하면 없어질 수 있으므로 JSON 백업을 사용하세요.
- 계정 연결 전에는 화면에 기기 저장 상태를 표시하며, 연결되지 않은 계정 기능은 안내로 대체합니다.
- 계정에 로그인하면 계정 기록을 불러옵니다. 게스트 기록은 자동으로 업로드하지 않습니다. 설정의 **이 기기의 게스트 기록 가져오기**로 명시적으로 추가합니다.
- 서버 저장 실패 시 미완료 변경을 로컬 큐에 남깁니다. 설정에서 재시도하거나 재접속하면 큐를 먼저 재시도합니다. 실패한 기록을 서버의 오래된 기록으로 덮어쓰지 않습니다.
- 서버 읽기 실패 시 변경을 막고 캐시를 유지합니다. 연결 복구 후 계정 기록 새로고침으로 다시 사용합니다.
- 변경/삭제된 개별 기록만 서버에 반영합니다. 다른 기기의 관계없는 기록은 지우지 않습니다. 같은 기록을 동시에 수정하면 마지막 저장이 적용됩니다. 실시간 공동 편집은 제공하지 않습니다.
- 백업 복원은 기존 기록과 병합합니다. ID가 같은 기록은 현재 기록을 유지합니다. 로그인 상태에서는 현재 계정에 저장됩니다.
- 게스트 모드는 오프라인에서도 이미 열린 화면에서 편집할 수 있습니다. 오프라인 앱 전체 재시작/서비스워커 캐시는 제공하지 않습니다.

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
- 실제 Supabase 가입/로그인, 계정간 RLS와 기기간 저장은 프로젝트 연결 후 위의 배포 후 확인 절차를 수행해야 합니다.

## 출처 및 권리

- [RingsDB API 안내](https://ringsdb.com/api/) / [API 문서](https://ringsdb.com/api/doc)
- [RingsDB 공개 저장소](https://github.com/seastan/ringsdb)
- [Render 무료 서비스 정책](https://render.com/docs/free)
- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)

카드 원문과 이미지의 권리는 Fantasy Flight Games 및 각 권리자에게 있습니다. RingsDB의 카드 데이터와 이미지는 Hall of Beorn을 참조합니다. 이 앱은 비공식 팬 프로젝트이며 Fantasy Flight Games의 제작·보증·지원·제휴를 받지 않습니다.
