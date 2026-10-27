// Vercel Node.js 함수. 비밀 키·상위 API URL·원본 오류를 응답/로그에 노출하지 않는다.
const { WEATHER_REGIONS, getKmaGrid, getKmaDates, makeKmaUrl, parseKmaResponse, judge } = require('../logic.js');

function publicSupabaseKey(key) {
  if (key.startsWith('sb_publishable_')) return true;
  try {
    return JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()).role === 'anon';
  } catch {
    return false;
  }
}

async function readTasks(region, url, key) {
  const tasks = [];
  const signal = AbortSignal.timeout(10000);
  // Supabase의 기본 응답 한도 이후의 일정도 누락하지 않는다.
  for (let offset = 0; ; offset += 1000) {
    const requestUrl = new URL('/rest/v1/wx_tasks', url);
    requestUrl.search = new URLSearchParams({
      select: 'id,title,region,kind,owner', region: 'eq.' + region,
      order: 'id.asc', limit: '1000', offset: String(offset),
    }).toString();
    const response = await fetch(requestUrl, {
      headers: { apikey: key, Accept: 'application/json' },
      signal, redirect: 'error',
    });
    if (!response.ok) throw new Error('일정 조회 실패');
    const rows = await response.json();
    if (!Array.isArray(rows)) throw new Error('일정 응답 오류');
    for (const row of rows) {
      if (row.region !== region || !['야외', '고소', '실내'].includes(row.kind)
          || typeof row.title !== 'string' || typeof row.owner !== 'string') {
        throw new Error('일정 응답 오류');
      }
      tasks.push({ id: row.id, title: row.title, region: row.region, kind: row.kind, owner: row.owner });
    }
    if (rows.length < 1000) return tasks;
  }
}

async function readWeather(region, dates) {
  const key = process.env.KMA_KEY?.trim();
  if (!key) return { weather: null, code: 'KMA_KEY_MISSING' };
  const provider = process.env.KMA_PROVIDER || 'apihub';
  if (!['apihub', 'datagokr'].includes(provider)) {
    return { weather: null, code: 'KMA_PROVIDER_INVALID' };
  }
  try {
    const url = makeKmaUrl(region, dates.baseDate, key, provider);
    const response = await fetch(url, { signal: AbortSignal.timeout(10000), redirect: 'error' });
    if (!response.ok) throw new Error('날씨 조회 실패');
    return { weather: parseKmaResponse(await response.json(), dates.date), code: null };
  } catch {
    return { weather: null, code: 'KMA_UNAVAILABLE' };
  }
}

module.exports = async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ error: { code: 'METHOD_NOT_ALLOWED', message: 'GET 요청만 지원합니다.' } });
  }
  let region;
  try {
    const regions = new URL(request.url, 'https://localhost').searchParams.getAll('region');
    if (regions.length !== 1 || !Object.hasOwn(WEATHER_REGIONS, regions[0])) throw new Error();
    region = regions[0];
  } catch {
    return response.status(400).json({ error: { code: 'INVALID_REGION', message: 'region에 세종·대전·태안·보령 중 하나를 지정해 주세요.' } });
  }

  const supabaseUrl = process.env.SUPABASE_URL?.trim();
  const supabaseKey = process.env.SUPABASE_PUBLIC_KEY?.trim();
  try {
    const url = new URL(supabaseUrl);
    if (url.protocol !== 'https:' || url.username || url.password
        || !supabaseKey || !publicSupabaseKey(supabaseKey)) throw new Error();
  } catch {
    return response.status(500).json({ error: {
      code: 'DATABASE_CONFIG_MISSING',
      message: '서버 환경변수 SUPABASE_URL과 공개용 SUPABASE_PUBLIC_KEY를 확인해 주세요.',
    } });
  }

  const dates = getKmaDates();
  const [databaseResult, weatherResult] = await Promise.allSettled([
    readTasks(region, supabaseUrl, supabaseKey), readWeather(region, dates),
  ]);
  if (databaseResult.status !== 'fulfilled') {
    return response.status(502).json({ error: { code: 'DATABASE_UNAVAILABLE', message: 'DB 일정을 조회하지 못했습니다. 연결과 조회 권한을 확인해 주세요.' } });
  }
  const result = weatherResult.status === 'fulfilled'
    ? weatherResult.value : { weather: null, code: 'KMA_UNAVAILABLE' };
  return response.status(200).json({
    region, date: dates.date,
    source: { database: 'Supabase wx_tasks', weather: '기상청 단기예보' },
    forecast: { baseDate: dates.baseDate, baseTime: dates.baseTime, grid: getKmaGrid(region) },
    units: { tempMax: '°C', windMax: 'm/s', rainProb: '%' },
    weather: result.weather,
    tasks: databaseResult.value.map(task => ({ ...task, judgment: judge(task.kind, result.weather) })),
    partial: result.weather === null,
    warnings: result.code ? [{ code: result.code, message: '기상청 예보를 확인하지 못했습니다. 서버 키·발급처·활용 신청·연결 상태를 확인해 주세요.' }] : [],
  });
};
