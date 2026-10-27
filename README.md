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

## 파일
| 파일 | 역할 |
|---|---|
| index.html | 화면 구조와 스크립트 로딩 |
| style.css | 디자인 |
| logic.js | 판단 규칙, 날씨 API 주소·응답 해석, Markdown 생성 |
| app.js | Supabase 조회·추가, 날씨 호출과 화면 동작 |
| config.js | Supabase 주소·공개용 키 두 줄 |
| setup.sql | 사용자가 실행하는 표·제약·RLS·초기 데이터 설정 |
| data/tasks.json | 이전 단계의 참고 데이터, 실행 시 사용하지 않음 |
| PRD.md | 요구사항과 완료 기준 |
| AGENTS.md·CLAUDE.md | AI 작업 규칙 |
| .gitignore | GitHub에서 제외할 파일 규칙 |

참고: [Supabase 공개용 키](https://supabase.com/docs/guides/getting-started/api-keys), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).
