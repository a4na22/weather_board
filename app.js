// app.js – 화면 동작 (목록 그리기, 일정 추가)

let baseTasks = [];
let addedTasks = [];
let tasks = [];
let loading = true;
let weatherByRegion = {};   // 03 단원에서 지역별 날씨를 넣음

async function loadTasks() {
  const button = document.getElementById('taskForm').querySelector('button');
  const msg = document.getElementById('msgBox');
  button.disabled = true;
  try {
    const response = await fetch('data/tasks.json');
    if (!response.ok) throw new Error('일정 파일 읽기 실패');
    const data = await response.json();
    if (!Array.isArray(data)) throw new Error('일정 목록 형식 오류');
    baseTasks = data;
  } catch (error) {
    msg.textContent = '배포 주소로 열어 주세요';
  }
  // 기본 JSON을 먼저 읽은 뒤, 화면에서 추가한 일정만 뒤에 붙인다.
  try {
    const saved = JSON.parse(localStorage.getItem('wx_added') || '[]');
    if (!Array.isArray(saved)) throw new Error('저장된 일정 형식 오류');
    addedTasks = saved;
  } catch (error) {
    msg.textContent += (msg.textContent ? ' · ' : '') + '브라우저에 저장된 일정을 읽을 수 없습니다.';
  }
  tasks = baseTasks.concat(addedTasks);
  renderTasks();
  loading = false;
  button.disabled = false;
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

function addTask(e) {
  e.preventDefault();
  if (loading) return;
  const t = {
    title: document.getElementById('titleInput').value.trim(),
    region: document.getElementById('regionInput').value,
    kind: document.getElementById('kindInput').value,
    owner: document.getElementById('ownerInput').value.trim(),
  };
  if (!t.title || !t.owner) return;
  const saved = addedTasks.concat(t);
  try {
    localStorage.setItem('wx_added', JSON.stringify(saved));
  } catch (error) {
    document.getElementById('msgBox').textContent = '브라우저에 일정을 저장할 수 없습니다.';
    return;
  }
  addedTasks = saved;
  tasks = baseTasks.concat(addedTasks);
  e.target.reset();
  renderTasks();
}

document.getElementById('taskForm').addEventListener('submit', addTask);
loadTasks();
