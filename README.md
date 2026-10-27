# 현장 일정 날씨판

가상 현장 일정을 Supabase에서 읽고 추가하며, 현재 판단 표를 Markdown으로 내려받는 교육용 프로젝트입니다.

## 처음 설정
1. Supabase 프로젝트의 SQL Editor에서 `setup.sql` 전체를 직접 실행합니다. `public.wx_tasks`, 지역·구분·빈값 제약, RLS 정책과 기본 가상 일정 6건이 생성됩니다. 같은 초기화 SQL을 다시 실행해도 동일한 기본 일정은 중복되지 않습니다. 새 표를 만드는 용도이며, 기존에 다른 구조로 만든 `wx_tasks`를 자동으로 변경하지는 않습니다.
2. Supabase 프로젝트의 Connect 또는 API Keys 안내에서 프로젝트 URL과 **publishable 공개용 키**를 확인합니다. 기존 **anon 공개용 키**도 사용할 수 있습니다. secret·service_role 키나 DB 비밀번호는 사용하지 않습니다.
3. `config.js`의 두 줄을 채웁니다. 주소와 공개용 키 외의 연결 정보는 추가하지 않습니다.

```javascript
const SUPABASE_URL = 'https://YOUR_PROJECT.supabase.co';
const SUPABASE_PUBLIC_KEY = 'YOUR_PUBLISHABLE_OR_ANON_KEY';
```

4. 인터넷에 연결한 상태에서 `index.html`을 더블클릭하거나 배포 주소로 엽니다. 외부 스크립트는 CDN의 `supabase-js` 하나만 사용합니다.

브라우저에서 사용하는 공개용 키는 사용자에게 보입니다. 이 교육용 구성은 RLS와 DB 권한으로 누구나 **조회·추가**만 할 수 있게 합니다. 수정·삭제는 허용하지 않습니다. 실제 이름·연락처·기관 자료는 저장하지 마세요.

## 일정 데이터
- 실행 시 일정의 원본은 Supabase `public.wx_tasks`입니다. `id` 오름차순으로 표시합니다.
- 추가 버튼을 누르면 DB에 저장하며, 성공한 행만 화면에 붙입니다. 저장 중에는 추가 버튼을 잠급니다.
- 다른 브라우저에서 추가한 일정은 새로고침하면 보입니다. 실시간 자동 갱신은 없습니다.
- 이전 `data/tasks.json`과 `localStorage`의 `wx_added`는 읽거나 변경하지 않습니다. 자동 이관도 하지 않습니다.
- 설정 누락·CDN 실패·DB 오류는 화면에 안내합니다. 저장에 실패해도 입력과 기존 목록은 남습니다. 통신이 끊겨 저장 결과가 불명확하면 새로고침해 DB 반영 여부를 먼저 확인하세요.

## 날씨와 판단 (F-04)
- 키 없는 [Open-Meteo 예보 API](https://open-meteo.com/en/docs)로 한국 시간 기준 오늘의 최고 기온·최대 풍속(m/s)·최대 강수확률을 조회합니다. API 주소 생성과 응답 해석은 `logic.js`, 실제 호출은 `app.js`에 있습니다.
- 대표 좌표는 세종 36.48/127.29, 대전 36.35/127.38, 태안 36.75/126.30, 보령 36.33/126.61입니다. 개별 작업 현장의 좌표나 실시간 관측이 아닙니다.
- DB 일정과 날씨를 별도로 조회합니다. 성공한 지역부터 표에 반영하고, 실패·누락값·잘못된 날짜나 단위·10초 초과는 해당 지역만 실패 처리합니다. 재시도는 새로고침합니다.
- 날씨가 없으면 `-`, 실내 이외 일정은 '날씨 확인 전'입니다. 실내는 항상 '영향 없음'입니다. 강풍 → 폭염 → 우천 순서로 하나만 표시하며, 이 기준은 교육용입니다.
- 주소 끝에 `?test=wind`를 붙이면 유효한 예보의 풍속만 12m/s로 바꿉니다. 화면에 시험 안내가 표시됩니다. API가 실패한 지역에는 시험값을 만들지 않으며 DB에도 저장하지 않습니다. 시험을 끝내려면 쿼리를 지우고 새로고침하세요.
- Markdown 저장은 그 시점의 표를 사용하므로 시험 중 저장하면 12m/s 시험값이 포함됩니다.

세종 요청 예시 (주소창에서도 확인 가능):

```text
https://api.open-meteo.com/v1/forecast?latitude=36.48&longitude=127.29&daily=temperature_2m_max,wind_speed_10m_max,precipitation_probability_max&timezone=Asia%2FSeoul&wind_speed_unit=ms&forecast_days=1
```

## 지역별 JSON API (F-07)
Vercel에 배포한 뒤 다음 주소를 엽니다. 로컬 HTML 더블클릭만으로는 서버 API를 실행할 수 없습니다.

```text
https://내배포주소/api/kma?region=대전
```

세종·대전·태안·보령 중 하나를 `region`에 지정합니다. 조회 전용 GET API이며 DB 쓰기는 하지 않습니다. 일정은 Supabase에서 조회하고 날씨·판단은 요청 시 계산합니다. 화면의 Open-Meteo 연결은 기존대로 동작합니다.

Vercel 프로젝트의 환경변수에 다음을 등록하고 적용 대상 환경(Production/Preview 등)을 확인한 뒤 재배포합니다. `config.js`의 값은 서버 환경변수에 자동 복사되지 않습니다.

| 환경변수 | 값 |
|---|---|
| `KMA_KEY` | 해당 서비스 활용 신청이 승인된 기상청 인증키. 서버에서만 사용 |
| `KMA_PROVIDER` | 선택 사항. 공공데이터포털 키이면 `datagokr`(기본), API허브 키이면 `apihub` |
| `SUPABASE_URL` | 현재 config.js에 사용 중인 Supabase 프로젝트 URL |
| `SUPABASE_PUBLIC_KEY` | 같은 프로젝트의 publishable 또는 기존 anon 공개용 키. service_role·secret 키 금지 |

API허브와 공공데이터포털은 인증키 발급처가 다릅니다. 발급처를 확인하고 설정하세요. 인증키는 요청 주소창·채팅·파일에 넣지 않습니다.

기본 End Point는 `https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0`이며, 서버에서 `/getVilageFcst`와 `serviceKey` 인증 방식을 사용합니다. `KMA_KEY`에 공공데이터포털 인증키를 등록하고 재배포하세요. 기존 `KMA_PROVIDER=apihub` 설정이 남아 있으면 `datagokr`로 변경하거나 제거해야 합니다. 노출된 인증키는 재발급 후 Vercel에 등록하세요.

응답 형태 예시 (아래 일정과 수치는 설명용 가상 데이터입니다):

```json
{
  "region": "대전",
  "date": "2026-10-27",
  "source": { "database": "Supabase wx_tasks", "weather": "기상청 단기예보" },
  "forecast": { "baseDate": "20261026", "baseTime": "2300", "grid": { "nx": 67, "ny": 100 } },
  "units": { "tempMax": "°C", "windMax": "m/s", "rainProb": "%" },
  "weather": { "tempMax": 25, "windMax": 12, "rainProb": 10 },
  "tasks": [
    { "id": 1, "title": "가상 현장 점검", "region": "대전", "kind": "고소", "owner": "가상담당", "judgment": { "level": "stop", "text": "중지 검토 (강풍)" } }
  ],
  "partial": false,
  "warnings": []
}
```

- 날씨는 **전날 23시 발표 예보**에서 오늘 날짜만 추출합니다. 최고 기온은 TMX, 최대 풍속은 오늘 24시간 WSD의 최댓값, 강수확률은 오늘 24시간 POP의 최댓값입니다. 하루 전체를 같은 발표 기준으로 비교하기 위한 방식이며 최신 발표나 관측값이 아닙니다. 기존 지역 대표 좌표를 기상청 5km 격자로 변환합니다.
- 오늘 TMX 또는 24시간 WSD·POP가 없으면 날씨를 임의 보완하지 않습니다. 날씨 조회 실패는 HTTP 200과 `weather: null`, `partial: true`, `warnings`를 반환합니다. DB 일정은 유지하고 실내는 영향 없음, 나머지는 날씨 확인 전으로 판단합니다.
- `KMA_KEY_MISSING`은 키 미등록, `KMA_PROVIDER_INVALID`는 발급처 설정 오류, `KMA_UNAVAILABLE`은 인증·활용 신청·통신·불완전 예보 등을 확인해야 하는 상태입니다. 원본 오류나 인증키 포함 URL은 반환하지 않습니다.
- 지역 누락·중복·잘못된 값은 400, GET 외 요청은 405, 서버 DB 연결 설정 오류는 500, DB 조회 실패는 502입니다. DB 조회 실패를 빈 목록으로 가장하지 않습니다. 정상 조회 결과가 실제로 없을 때만 `tasks: []`입니다.
- API 응답은 저장하지 않도록 `Cache-Control: no-store`를 사용합니다. `?test=wind` 시험은 기존 화면 기능이며 이 서버 API는 실제 예보만 반환합니다.

참고: [기상청 API허브 요청 안내](https://data.kma.go.kr/community/nuriLovePopup.do), [공공데이터포털 단기예보](https://www.data.go.kr/data/15084084/openapi.do), [Vercel Node.js 함수](https://vercel.com/docs/functions/runtimes/node-js).

## 확인 방법
- **T-01:** 초기 설정 후 더블클릭해 DB의 기본 일정 6건이 보이는지 확인합니다.
- **T-02·T-03:** 가상 일정을 추가하고 새로고침해도 중복 없이 남는지 확인합니다.
- **T-04:** 일정 이름이나 담당이 비었거나 공백뿐이면 추가되지 않는지 확인합니다.
- **T-05:** `index.html?test=wind` 또는 배포 주소 뒤에 `?test=wind`를 붙입니다. 정상 조회된 지역은 풍속 12m/s, 기본 고소 일정 2건은 해당 지역의 조회 성공 시 '중지 검토 (강풍)'인지 확인합니다. 실내는 '영향 없음'이어야 합니다.
- **T-06·07·08:** PRD에 적힌 개발자 도구 콘솔 예시로 폭염 33℃·우천 60% 경계값, 보통 날씨와 실내 예외를 확인합니다.
- **T-09:** DB 오류가 있어도 제목 아래에 한국 시간 기준 날짜가 보이는지 확인합니다.
- **T-10:** '오늘 판단 md로 저장'을 눌러 `현장일정_판단_YYYY-MM-DD.md`를 받습니다. 현재 표의 6개 열·모든 일정과 마지막 판단 기준 줄을 확인합니다.
- **T-11:** 추가한 행을 Supabase Table Editor의 `wx_tasks`에서 확인하고, 다른 브라우저에서도 새로고침해 확인합니다.
- **T-12:** SQL Editor에서 다음 두 문장을 각각 실행하면 지역·구분 제약 오류가 나야 합니다. 일정 이름 또는 담당을 빈 문자열·공백으로 바꾼 경우도 거부되어야 합니다.

```sql
insert into public.wx_tasks (title, region, kind, owner)
values ('가상 제약 확인', '허용되지않은지역', '야외', '가상담당');

insert into public.wx_tasks (title, region, kind, owner)
values ('가상 제약 확인', '세종', '허용되지않은구분', '가상담당');
```

- **T-13:** 연결 설정을 비우거나 인터넷을 끊으면 오류가 표시되는지 확인합니다. 저장 중 여러 번 눌러도 한 번만 처리되는지, 실패하면 입력과 기존 표가 유지되는지 확인합니다. 설정을 복원한 뒤 새로고침합니다.
- **T-14:** 일반 주소에서 새로고침해 각 지역 조회 상태와 표의 날씨 3개 값·판단을 확인합니다. 같은 지역의 일정은 같은 날씨를 사용합니다.
- **T-15:** 개발자 도구에서 Open-Meteo 요청만 차단하고 새로고침해도 DB 일정과 추가 기능은 유지되는지 확인합니다. 실패 안내·날씨 `-`·실내 외 '날씨 확인 전'을 확인합니다. 일부 지역만 실패하면 나머지 지역 날씨는 보여야 합니다.
- **T-16:** 배포 주소의 `/api/kma?region=대전`을 열어 대전 DB 일정·날씨·판단 JSON을 확인합니다. 다른 허용 지역으로 바꾸면 해당 지역 일정만 나와야 합니다.
- **T-17:** `region` 누락·서울·중복값은 400, POST는 405인지 확인합니다. 실제 일정이 없는 지역은 `tasks: []`여야 합니다.
- **T-18:** 기상청 요청 실패 시에도 일정과 경고가 반환되는지, DB 조회 실패는 502인지 확인합니다. 운영 키를 채팅에 붙여 넣지 말고 Preview 등의 별도 시험 환경을 이용합니다.
- **T-19:** 응답에 인증키·Supabase 키·인증키 포함 URL·원본 외부 오류가 없는지 확인합니다.

## 파일
| 파일 | 역할 |
|---|---|
| index.html | 화면 구조와 스크립트 로딩 |
| style.css | 디자인 |
| logic.js | 판단 규칙, 날씨 API 주소·응답 해석, Markdown 생성 |
| app.js | Supabase 조회·추가, 날씨 호출과 화면 동작 |
| api/kma.js | Vercel 서버에서 지역별 일정·기상청 날씨·판단 JSON 응답 |
| config.js | Supabase 주소·공개용 키 두 줄 |
| setup.sql | 사용자가 실행하는 표·제약·RLS·초기 데이터 설정 |
| data/tasks.json | 이전 단계의 참고 데이터, 실행 시 사용하지 않음 |
| PRD.md | 요구사항과 완료 기준 |
| AGENTS.md·CLAUDE.md | AI 작업 규칙 |
| .gitignore | GitHub에서 제외할 파일 규칙 |

참고: [Supabase 공개용 키](https://supabase.com/docs/guides/getting-started/api-keys), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).
