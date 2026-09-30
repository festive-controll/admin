import { readFileSync, writeFileSync } from 'fs';

const raw = JSON.parse(readFileSync('live_data.json', 'utf-8'));
const { programs, results } = raw;
const names = ['Reyhani', 'Thugra', 'Diwani', 'Thuluth'];

const resultsByProgram = new Map();
results.forEach(r => {
  if (!r.programId) return;
  if (!resultsByProgram.has(r.programId)) resultsByProgram.set(r.programId, []);
  resultsByProgram.get(r.programId).push(r);
});

function getPoints(r) {
  for (const k of ['totalPoints', 'points', 'score']) {
    if (r[k] !== undefined && r[k] !== null && r[k] !== '' && Number.isFinite(Number(r[k]))) return Number(r[k]);
  }
  return (Number(r.gradePoints) || 0) + (Number(r.positionPoints) || 0);
}

function resolveCategory(p) {
  const rawType = [p.venueTypeName, p.venueType, p.venue_type, p.category].find(v => typeof v === 'string' && v.trim());
  const norm = String(rawType || '').toLowerCase().replace(/[\s_-]+/g, '');
  if (norm.includes('sport')) return 'Sports';
  if (norm.includes('nonstage')) return 'Non-Stage';
  if (norm === 'stage' || norm.endsWith('stage')) return 'Stage';
  const c = String(p.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (/^[A-Z]*X\d+/.test(c)) return 'Non-Stage';
  if (/^[A-Z]*Y\d+/.test(c)) return 'Stage';
  if (/^[A-Z]*Z\d+/.test(c)) return 'Sports';
  return 'Arts';
}

const allArts = [];
programs.forEach(p => {
  const pResults = resultsByProgram.get(p.id) || [];
  if (pResults.length === 0) return;
  const cat = resolveCategory(p);
  if (cat === 'Sports') return;
  const pts = { Reyhani: 0, Thugra: 0, Diwani: 0, Thuluth: 0 };
  pResults.forEach(r => {
    const teamName = r.team || r.teamName;
    const match = names.find(n => n.toLowerCase() === String(teamName).toLowerCase());
    if (match) pts[match] += getPoints(r);
  });
  allArts.push({
    id: p.id,
    code: p.code || '',
    name: p.name || '',
    section: p.section || '',
    category: cat,
    isPublished: p.resultsPublished === true || p.code === 'TY23', // TY23 is published
    pts
  });
});

const baseArts = { Reyhani: 0, Thugra: 0, Diwani: 0, Thuluth: 0 };
allArts.filter(p => p.isPublished).forEach(p => {
  names.forEach(n => baseArts[n] += p.pts[n]);
});
const unpub = allArts.filter(p => !p.isPublished);

console.log('Updated Base Arts (with TY23 published):', baseArts);
console.log('Remaining Unpublished Arts count:', unpub.length);

let bestSolution = null;
let minCount = 999;

for (let iter = 0; iter < 1000000; iter++) {
  // Test sizes 17 to 25
  const sz = Math.floor(Math.random() * 8) + 17;
  const cur = { ...baseArts };
  const subset = [];
  
  const weightedPool = unpub.map(p => {
    const score = (p.pts.Reyhani * 1.6 + p.pts.Thugra * 2.8 - p.pts.Diwani * 2.0 - p.pts.Thuluth * 2.2) + (Math.random() * 16 - 8);
    return { p, score };
  }).sort((a,b) => b.score - a.score);

  for (let i = 0; i < sz && i < weightedPool.length; i++) {
    const p = weightedPool[i].p;
    subset.push(p);
    names.forEach(n => cur[n] += p.pts[n]);
  }

  if (cur.Reyhani > cur.Thugra && cur.Thugra > cur.Diwani && cur.Diwani > cur.Thuluth) {
    const m1 = cur.Reyhani - cur.Thugra;
    const m2 = cur.Thugra - cur.Diwani;
    const m3 = cur.Diwani - cur.Thuluth;
    if (subset.length < minCount) {
      minCount = subset.length;
      bestSolution = { count: subset.length, scores: cur, margins: [m1, m2, m3], subset };
      console.log('New min count found:', minCount, 'Scores:', cur, 'Margins:', [m1, m2, m3]);
    } else if (subset.length === minCount) {
      const minMargin = Math.min(m1, m2, m3);
      const curBestMinMargin = Math.min(...bestSolution.margins);
      if (minMargin > curBestMinMargin) {
        bestSolution = { count: subset.length, scores: cur, margins: [m1, m2, m3], subset };
        console.log('Better margin at count', minCount, ':', [m1, m2, m3]);
      }
    }
  }
}

if (bestSolution) {
  console.log('\n--- BEST MINIMUM COUNT SOLUTION (TY23 EXCLUDED) ---');
  console.log('Count:', bestSolution.count);
  console.log('Scores:', bestSolution.scores);
  console.log('Margins:', bestSolution.margins);

  const lines = [
    "================================================================================",
    `SMALLEST COUNT OF ARTS PROGRAMS TO CLICK 'PUBLISH' (ONLY ${bestSolution.count} PROGRAMS)`,
    "TO SET: 1-Reyhani, 2-Thugra, 3-Diwani, 4-Thuluth",
    "================================================================================",
    "",
    "Arts Final Standings (Smallest Count to Publish):",
    `1. Reyhani  : ${bestSolution.scores.Reyhani} Points (1st Position - Champion)`,
    `2. Thugra   : ${bestSolution.scores.Thugra} Points (2nd Position - Runner-up)`,
    `3. Diwani   : ${bestSolution.scores.Diwani} Points (3rd Position)`,
    `4. Thuluth  : ${bestSolution.scores.Thuluth} Points (4th Position)`,
    "",
    "Safety Lead Margins (Arts Only):",
    `- Reyhani leads Thugra by +${bestSolution.margins[0]} pts`,
    `- Thugra leads Diwani by +${bestSolution.margins[1]} pts`,
    `- Diwani leads Thuluth by +${bestSolution.margins[2]} pts`,
    "",
    "Current Published Arts Base Standings (including TY23):",
    `- Thuluth : ${baseArts.Thuluth} pts`,
    `- Diwani  : ${baseArts.Diwani} pts`,
    `- Reyhani : ${baseArts.Reyhani} pts`,
    `- Thugra  : ${baseArts.Thugra} pts`,
    "",
    "--------------------------------------------------------------------------------",
    `MINIMUM ${bestSolution.count} ARTS PROGRAMS TO CLICK 'PUBLISH' ON THE PUBLISH PAGE`,
    "(Strictly Stage and Non-Stage Arts programs only - TY23 excluded as published)",
    "--------------------------------------------------------------------------------"
  ];

  bestSolution.subset.forEach((p, i) => {
    const num = (i + 1).toString().padStart(2, ' ');
    const code = `[${p.code.padEnd(6, ' ')}]`;
    const name = p.name.padEnd(28, ' ');
    const sec = `Section: ${p.section.padEnd(12, ' ')}`;
    const cat = `Category: ${p.category.padEnd(10, ' ')}`;
    const pts = `(+${p.pts.Reyhani} Reyhani, +${p.pts.Thugra} Thugra, +${p.pts.Diwani} Diwani, +${p.pts.Thuluth} Thuluth)`;
    lines.push(`${num}. ${code} ${name} | ${sec} | ${cat} | ${pts}`);
  });

  lines.push("", "================================================================================", "");

  writeFileSync('data.txt', lines.join('\n'));
  console.log('Saved to data.txt successfully!');
}
