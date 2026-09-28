# 서부의 기록 · LOTRKDB

Fantasy Flight Games의 **The Lord of the Rings: The Card Game (LCG)**만 다루는 한국어 웹 애플리케이션입니다. 다른 반지의 제왕 게임이나 TCG를 포함하지 않습니다.

## 구현 기능

- 카드 DB: 이름·특성·효과·번호 검색, 영역·유형·제품 필터, 페이지 이동, 카드 이미지와 영어 원문, 정오표, 재수록 제품 표시.
- 덱: 영웅·동료·부착·이벤트·부가 퀘스트 편집, 기본 구성 검사, 영웅 위협 합산, 메모, JSON 내보내기/가져오기, RingsDB 공개 덱 가져오기.
- 시나리오: 검색, 제품/승리 여부 필터, 조우 세트·모드별 정보 조회, 도전/승리 집계.
- 플레이 기록: 덱·캠페인 연결, 1~4인, 쉬움/일반/악몽, 진행 중/승리/패배, 날짜·라운드·위협·피해·승점·메모, 점수 계산.
- 캠페인: 시나리오 선택, 해당 캠페인의 승리 집계, 은혜·부담·메모.
- 보유 제품: 개정판 등 재수록 제품을 포함한 소유 카드 필터.
- 저장: 게스트 기기 저장, Supabase 이메일 가입/로그인/비밀번호 재설정, 계정별 RLS, JSON 백업/복원.
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

## 무료 배포: Render Static Site + Supabase

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

방법 A: Render Dashboard → **New → Blueprint**에서 이 저장소의 `render.yaml`을 적용합니다. 생성되는 서비스는 무료 정적 사이트입니다. 두 환경변수를 입력합니다.

방법 B: **New → Static Site**에서 저장소를 연결합니다.

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
