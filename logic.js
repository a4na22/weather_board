// logic.js – 판단 규칙·API 주소·응답 해석 (화면 조작·통신 호출 없음)

// 교육용 가상 기준 (실제 작업 중지 · 행사 취소 기준은 각 기관 규정을 따름)
const RULES = { wind: 10, rain: 60, heat: 33 };

// 각 지역 중심 부근의 대표 좌표 (개별 작업 현장 좌표가 아님)
const WEATHER_REGIONS = {
  '세종': { latitude: 36.48, longitude: 127.29 },
  '대전': { latitude: 36.35, longitude: 127.38 },
  '태안': { latitude: 36.75, longitude: 126.30 },
  '보령': { latitude: 36.33, longitude: 126.61 },
};

function makeWeatherUrl(region) {
  if (!Object.hasOwn(WEATHER_REGIONS, region)) throw new Error('지원하지 않는 지역');
  const coordinates = WEATHER_REGIONS[region];
  const params = new URLSearchParams({
    latitude: coordinates.latitude,
    longitude: coordinates.longitude,
    daily: 'temperature_2m_max,wind_speed_10m_max,precipitation_probability_max',
    timezone: 'Asia/Seoul', wind_speed_unit: 'ms', forecast_days: '1',
  });
  return 'https://api.open-meteo.com/v1/forecast?' + params.toString();
}

function parseWeatherResponse(response, today, testWind = false) {
  const daily = response?.daily;
  const units = response?.daily_units;
  const tempMax = daily?.temperature_2m_max?.[0];
  const windMax = daily?.wind_speed_10m_max?.[0];
  const rainProb = daily?.precipitation_probability_max?.[0];
  if (daily?.time?.[0] !== today
      || ![tempMax, windMax, rainProb].every(Number.isFinite)
      || windMax < 0 || rainProb < 0 || rainProb > 100
      || units?.temperature_2m_max !== '°C'
      || units?.wind_speed_10m_max !== 'm/s'
      || units?.precipitation_probability_max !== '%') {
    throw new Error('오늘 날씨 응답의 날짜·값·단위를 확인할 수 없습니다.');
  }
  return { tempMax, windMax: testWind ? 12 : windMax, rainProb };
}

// 기상청 공식 Lambert conformal 격자 정의로 기존 대표 좌표를 변환한다.
function getKmaGrid(region) {
  if (!Object.hasOwn(WEATHER_REGIONS, region)) throw new Error('지원하지 않는 지역');
  const { latitude, longitude } = WEATHER_REGIONS[region];
  const radians = Math.PI / 180;
  const lat1 = 30 * radians;
  const lat2 = 60 * radians;
  const sn = Math.log(Math.cos(lat1) / Math.cos(lat2))
    / Math.log(Math.tan(Math.PI / 4 + lat2 / 2) / Math.tan(Math.PI / 4 + lat1 / 2));
  const sf = Math.pow(Math.tan(Math.PI / 4 + lat1 / 2), sn) * Math.cos(lat1) / sn;
  const radius = 6371.00877 / 5;
  const ro = radius * sf / Math.pow(Math.tan(Math.PI / 4 + 38 * radians / 2), sn);
  const ra = radius * sf / Math.pow(Math.tan(Math.PI / 4 + latitude * radians / 2), sn);
  const theta = (longitude - 126) * radians * sn;
  return {
    nx: Math.floor(ra * Math.sin(theta) + 43 + 0.5),
    ny: Math.floor(ro - ra * Math.cos(theta) + 136 + 0.5),
  };
}

function getKmaDates(now = new Date()) {
  const koreanDate = new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const yesterday = new Date(Date.parse(koreanDate + 'T00:00:00Z') - 86400000);
  return { date: koreanDate, baseDate: yesterday.toISOString().slice(0, 10).replace(/-/g, ''), baseTime: '2300' };
}

// 키를 포함한 반환 URL은 서버 내부에서만 사용한다. 출력·로그에 넣지 않는다.
function makeKmaUrl(region, baseDate, key, provider = 'datagokr') {
  const grid = getKmaGrid(region);
  const endpoints = {
    apihub: 'https://apihub.kma.go.kr/api/typ02/openApi/VilageFcstInfoService_2.0/getVilageFcst',
    datagokr: 'https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst',
  };
  if (!Object.hasOwn(endpoints, provider)) throw new Error('지원하지 않는 기상청 발급처');
  const url = new URL(endpoints[provider]);
  // 포털의 Encoding 키를 등록한 경우 이중 인코딩을 피한다.
  const normalizedKey = provider === 'datagokr' && /%[0-9a-f]{2}/i.test(key)
    ? decodeURIComponent(key) : key;
  url.search = new URLSearchParams({
    pageNo: '1', numOfRows: '1000', dataType: 'JSON',
    base_date: baseDate, base_time: '2300', nx: grid.nx, ny: grid.ny,
    [provider === 'apihub' ? 'authKey' : 'serviceKey']: normalizedKey,
  }).toString();
  return url.toString();
}

function parseKmaResponse(payload, date) {
  const response = payload?.response;
  const items = response?.body?.items?.item;
  if (response?.header?.resultCode !== '00' || !Array.isArray(items)) {
    throw new Error('기상청 예보를 확인할 수 없습니다.');
  }
  const day = date.replace(/-/g, '');
  const values = { TMX: new Map(), WSD: new Map(), POP: new Map() };
  for (const item of items) {
    if (item.fcstDate !== day || !Object.hasOwn(values, item.category)) continue;
    const raw = item.fcstValue;
    if ((typeof raw !== 'string' && typeof raw !== 'number') || String(raw).trim() === '') {
      throw new Error('예보 값 누락');
    }
    const value = Number(raw);
    const validTime = /^(?:[01][0-9]|2[0-3])00$/.test(item.fcstTime);
    const validValue = Number.isFinite(value) && (item.category === 'TMX'
      ? value > -100 && value < 70
      : value >= 0 && value <= (item.category === 'POP' ? 100 : 200));
    if (!validTime || !validValue) throw new Error('예보 값 오류');
    const previous = values[item.category].get(item.fcstTime);
    if (previous !== undefined && previous !== value) throw new Error('중복 예보 값 오류');
    values[item.category].set(item.fcstTime, value);
  }
  // 일부 시간만 받은 데이터를 하루 최대치로 잘못 표시하지 않는다.
  if (!values.TMX.size || values.WSD.size !== 24 || values.POP.size !== 24) {
    throw new Error('오늘 하루 예보가 완전하지 않습니다.');
  }
  return {
    tempMax: Math.max(...values.TMX.values()),
    windMax: Math.max(...values.WSD.values()),
    rainProb: Math.max(...values.POP.values()),
  };
}

// 일정 구분과 날씨로 판단 (w가 없으면 '날씨 확인 전')
function judge(kind, w) {
  if (kind === '실내') return { level: 'ok', text: '영향 없음' };
  if (!w) return { level: 'none', text: '날씨 확인 전' };
  if (kind === '고소' && w.windMax >= RULES.wind) return { level: 'stop', text: '중지 검토 (강풍)' };
  if (w.tempMax >= RULES.heat) return { level: 'warn', text: '폭염 휴식' };
  if (w.rainProb >= RULES.rain) return { level: 'warn', text: '우천 주의' };
  return { level: 'ok', text: '진행' };
}

// 화면에서 읽은 표 값을 받아 Markdown 문자열만 만든다.
function makeJudgmentMarkdown(headers, rows, date) {
  function escapeCell(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/[\\|`*_{}\[\]()!#]/g, '\\$&')
      .replace(/\r\n|\r|\n/g, '<br>');
  }
  const tableRow = cells => '| ' + cells.map(escapeCell).join(' | ') + ' |';
  return [
    `# 오늘 판단 (${date})`,
    '',
    tableRow(headers),
    '| ' + headers.map(() => '---').join(' | ') + ' |',
    ...rows.map(tableRow),
    '',
    `판단 기준(교육용): 고소 작업 풍속 ${RULES.wind}m/s 이상 → 중지 검토 · 강수확률 ${RULES.rain}% 이상 → 우천 주의 · 최고 기온 ${RULES.heat}℃ 이상 → 폭염 휴식 (실내는 영향 없음, 우선순위: 강풍 → 폭염 → 우천)`,
    '',
  ].join('\n');
}

if (typeof module !== 'undefined') module.exports = {
  RULES, WEATHER_REGIONS, makeWeatherUrl, parseWeatherResponse, judge, makeJudgmentMarkdown,
  getKmaGrid, getKmaDates, makeKmaUrl, parseKmaResponse,
};
