// logic.js – 판단 규칙만 (화면을 다루는 코드 금지)

// 교육용 가상 기준 (실제 작업 중지 · 행사 취소 기준은 각 기관 규정을 따름)
const RULES = { wind: 10, rain: 60, heat: 33 };

// 일정 구분과 날씨로 판단 (w가 없으면 '날씨 확인 전')
function judge(kind, w) {
  if (!w) return { level: 'none', text: '날씨 확인 전' };
  if (kind === '실내') return { level: 'ok', text: '영향 없음' };
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

if (typeof module !== 'undefined') module.exports = { RULES, judge, makeJudgmentMarkdown };
