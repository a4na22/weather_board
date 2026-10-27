// app.js – 화면 동작 (목록 그리기, 일정 추가)

let tasks = [];
let loading = true;
let saving = false;
let taskDatabase = null;
let weatherByRegion = {};
const weatherStatus = {};
const testWind = new URLSearchParams(window.location.search).get('test') === 'wind';

function renderWeatherStatus() {
  const box = document.getElementById('weatherBox');
  box.textContent = (testWind ? '[강풍 시험: 받은 풍속을 12m/s로 변경] ' : '')
    + Object.keys(WEATHER_REGIONS).map(region => region + ': ' + weatherStatus[region]).join(' · ')
    + ' · 예보 출처: ';
  const source = document.createElement('a');
  source.href = 'https://open-meteo.com/';
  source.textContent = 'Open-Meteo';
  box.appendChild(source);
}

async function loadWeather() {
  const today = document.getElementById('todayDate').dateTime;
  const regions = Object.keys(WEATHER_REGIONS);
  for (const region of regions) weatherStatus[region] = '확인 중';
  renderWeatherStatus();
  await Promise.all(regions.map(async region => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch(makeWeatherUrl(region), { signal: controller.signal });
      if (!response.ok) throw new Error('날씨 요청 실패');
      weatherByRegion[region] = parseWeatherResponse(await response.json(), today, testWind);
      weatherStatus[region] = '확인 완료';
    } catch (error) {
      delete weatherByRegion[region];
      weatherStatus[region] = '불러오기 실패 (새로고침해 주세요)';
    } finally {
      clearTimeout(timeout);
      renderWeatherStatus();
      renderTasks();
    }
  }));
}

function connectDatabase() {
  if (typeof SUPABASE_URL === 'undefined' || typeof SUPABASE_PUBLIC_KEY === 'undefined'
      || !SUPABASE_URL || !SUPABASE_PUBLIC_KEY) {
    throw new Error('config.js에 Supabase 주소와 공개용 키를 입력해 주세요.');
  }
  // 브라우저에는 publishable 키 또는 role이 anon인 기존 공개 키만 허용한다.
  let publicKey = SUPABASE_PUBLIC_KEY.startsWith('sb_publishable_');
  if (!publicKey) {
    try {
      const encoded = SUPABASE_PUBLIC_KEY.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      const payload = JSON.parse(atob(encoded.padEnd(Math.ceil(encoded.length / 4) * 4, '=')));
      publicKey = payload.role === 'anon';
    } catch (error) {
      publicKey = false;
    }
  }
  if (!publicKey) throw new Error('공개용 publishable 또는 anon 키만 사용해 주세요. 비밀 키는 사용할 수 없습니다.');
  if (typeof supabase === 'undefined') throw new Error('Supabase 스크립트를 읽지 못했습니다. 인터넷 연결을 확인하고 새로고침해 주세요.');
  return supabase.createClient(SUPABASE_URL, SUPABASE_PUBLIC_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

function renderToday() {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const date = Object.fromEntries(parts.map(part => [part.type, part.value]));
  const value = `${date.year}-${date.month}-${date.day}`;
  const element = document.getElementById('todayDate');
  element.textContent = value;
  element.dateTime = value;
  return value;
}

async function loadTasks() {
  const button = document.getElementById('taskForm').querySelector('button');
  const msg = document.getElementById('msgBox');
  button.disabled = true;
  loading = true;
  msg.textContent = 'Supabase에서 일정을 불러오는 중입니다.';
  try {
    if (!taskDatabase) taskDatabase = connectDatabase();
    const { data, error } = await taskDatabase.from('wx_tasks')
      .select('id,title,region,kind,owner').order('id', { ascending: true });
    if (error || !Array.isArray(data)) throw new Error('일정을 읽지 못했습니다. 인터넷 연결과 setup.sql 실행·조회 권한을 확인한 뒤 새로고침해 주세요.');
    tasks = data;
    renderTasks();
    msg.textContent = data.length ? '' : '등록된 일정이 없습니다.';
  } catch (error) {
    msg.textContent = taskDatabase
      ? '일정을 읽지 못했습니다. 인터넷 연결과 setup.sql 실행·조회 권한을 확인한 뒤 새로고침해 주세요.'
      : error.message;
  } finally {
    loading = false;
    button.disabled = !taskDatabase;
    document.getElementById('saveMarkdown').disabled = false;
  }
}

function saveJudgmentMarkdown() {
  if (loading) return;
  const date = renderToday();
  const headers = Array.from(document.querySelectorAll('thead th'), cell => cell.textContent);
  const rows = Array.from(document.getElementById('taskList').rows,
    row => Array.from(row.cells, cell => cell.textContent));
  const markdown = makeJudgmentMarkdown(headers, rows, date);
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `현장일정_판단_${date}.md`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function weatherText(w) {
  return w ? w.tempMax + '℃ · ' + w.windMax + 'm/s · ' + w.rainProb + '%' : '-';
}

function renderTasks() {
  const body = document.getElementById('taskList');
  body.innerHTML = '';
  for (const t of tasks) {
    const w = weatherByRegion[t.region];
    const r = judge(t.kind, w);
    const tr = document.createElement('tr');
    for (const v of [t.title, t.region, t.kind, t.owner, weatherText(w)]) {
      const td = document.createElement('td');
      td.textContent = v;
      tr.appendChild(td);
    }
    const td = document.createElement('td');
    td.textContent = r.text;
    td.className = r.level;
    tr.appendChild(td);
    body.appendChild(tr);
  }
}

async function addTask(e) {
  e.preventDefault();
  if (loading || saving || !taskDatabase) return;
  const t = {
    title: document.getElementById('titleInput').value.trim(),
    region: document.getElementById('regionInput').value,
    kind: document.getElementById('kindInput').value,
    owner: document.getElementById('ownerInput').value.trim(),
  };
  if (!t.title || !t.owner) return;
  const button = document.getElementById('taskForm').querySelector('button');
  const msg = document.getElementById('msgBox');
  saving = true;
  button.disabled = true;
  msg.textContent = 'Supabase에 저장하는 중입니다.';
  try {
    const { data, error } = await taskDatabase.from('wx_tasks')
      .insert(t).select('id,title,region,kind,owner').single();
    if (error || !data) throw new Error('저장 실패');
    tasks.push(data);
    renderTasks();
    e.target.reset();
    msg.textContent = 'Supabase에 저장했습니다.';
  } catch (error) {
    msg.textContent = '저장하지 못했습니다. 인터넷 연결, 지역·구분 값과 DB 권한을 확인해 주세요. 응답을 받지 못했다면 새로고침해 저장 여부를 확인한 뒤 다시 추가해 주세요.';
  } finally {
    saving = false;
    button.disabled = false;
  }
}

document.getElementById('taskForm').addEventListener('submit', addTask);
document.getElementById('saveMarkdown').addEventListener('click', saveJudgmentMarkdown);
renderToday();
loadTasks();
loadWeather();
