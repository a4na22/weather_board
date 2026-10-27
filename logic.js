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
};
