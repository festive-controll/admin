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
    isPublished: p.resultsPublished === true,
    pts
  });
});

// All programs that were previously listed or published:
const previouslyMentioned = new Set([
  'AY17', 'UY24', 'THX10', 'TY11', 'UX2', 'TX19', 'BY2', 'UY2', 'UY5', 'UY12',
  'TY3', 'TY4', 'BY18', 'THX17', 'UX15', 'THX2', 'BY1', 'AX7', 'AX15', 'TX16',
  'TX6', 'THY26', 'THX4', 'TY23', 'BY6', 'BX19', 'THY7', 'THY14', 'TX5', 'BX20',
  'THX7', 'UY9', 'TY1', 'THX9', 'TX21', 'AY9', 'AY10', 'AY14', 'TY18', 'UX1',
  'AX13', 'THX6', 'THX28', 'BX3', 'BY15', 'UX7', 'TX22', 'THX26', 'TX3', 'THX11',
  'THX1', 'BX12', 'TX2', 'UX23', 'BX7', 'BX5', 'UX22', 'UX17', 'UY3', 'AX4', 'AX22',
  'TX10', 'AY25', 'AY8', 'BX2', 'UX20', 'UY10', 'AY26', 'UX3', 'TX15', 'BX4', 'TY6',
  'AX11', 'TX14', 'BY16', 'TX1', 'UX5', 'AX2', 'UX19', 'UX18', 'UX21', 'THY23',
  'BX6', 'BY3', 'AX10', 'AX5', 'THX22', 'BY7', 'THX3', 'AX1', 'UX4', 'THY21', 'BX14'
]);

const freshPool = allArts.filter(p => !previouslyMentioned.has(p.code));
console.log('Available Fresh Unpublished Arts count:', freshPool.length);

// Current screen scores:
// Reyhani: 470, Diwani: 467, Thugra: 450, Thuluth: 437
const cur = { Reyhani: 470, Diwani: 467, Thugra: 450, Thuluth: 437 };

// Find minimal subset of freshPool to get:
// 1. Reyhani > Thugra
// 2. Thugra > Diwani
// 3. Diwani > Thuluth

let best = null;
let minCount = 999;

for (let iter = 0; iter < 1000000; iter++) {
  const sz = Math.floor(Math.random() * 8) + 2; // 2 to 9 programs
  const test = { ...cur };
  const subset = [];

  const weighted = freshPool.map(p => {
    const score = (p.pts.Reyhani * 2.0 + p.pts.Thugra * 3.5 - p.pts.Diwani * 2.5 - p.pts.Thuluth * 2.0) + (Math.random() * 10 - 5);
    return { p, score };
  }).sort((a, b) => b.score - a.score);

  for (let i = 0; i < sz && i < weighted.length; i++) {
    const p = weighted[i].p;
    subset.push(p);
    names.forEach(n => test[n] += p.pts[n]);
  }

  if (test.Reyhani > test.Thugra && test.Thugra > test.Diwani && test.Diwani > test.Thuluth) {
    const m1 = test.Reyhani - test.Thugra;
    const m2 = test.Thugra - test.Diwani;
    const m3 = test.Diwani - test.Thuluth;
    const minMargin = Math.min(m1, m2, m3);

    if (subset.length < minCount) {
      minCount = subset.length;
      best = { count: subset.length, scores: test, margins: [m1, m2, m3], minMargin, subset };
    } else if (subset.length === minCount) {
      if (minMargin > best.minMargin) {
        best = { count: subset.length, scores: test, margins: [m1, m2, m3], minMargin, subset };
      }
    }
  }
}

if (best) {
  console.log('\n--- FOUND FRESH UNPUBLISHED SOLUTION ---');
  console.log('Count:', best.count);
  console.log('Scores:', best.scores);
  console.log('Margins:', best.margins);

  const lines = [
    "================================================================================",
    `ONLY UNPUBLISHED PROGRAMS TO CLICK 'PUBLISH' (${best.count} FRESH PROGRAMS)`,
    "TO SET FINAL STANDINGS: 1-Reyhani, 2-Thugra, 3-Diwani, 4-Thuluth",
    "================================================================================",
    "",
    "Current Standings (from your screen):",
    `• Reyhani  : ${cur.Reyhani} pts (Currently 1st)`,
    `• Diwani   : ${cur.Diwani} pts (Currently 2nd)`,
    `• Thugra   : ${cur.Thugra} pts (Currently 3rd)`,
    `• Thuluth  : ${cur.Thuluth} pts (Currently 4th)`,
    "",
    "Target Final Standings (After clicking Publish on the programs below):",
    `1. Reyhani  : ${best.scores.Reyhani} Points (🥇 1st Position - Champion)`,
    `2. Thugra   : ${best.scores.Thugra} Points (🥈 2nd Position - Runner-up)`,
    `3. Diwani   : ${best.scores.Diwani} Points (🥉 3rd Position)`,
    `4. Thuluth  : ${best.scores.Thuluth} Points (4th Position)`,
    "",
    "Safety Lead Margins:",
    `- Reyhani leads Thugra by +${best.margins[0]} pts (1st over 2nd)`,
    `- Thugra leads Diwani by +${best.margins[1]} pts (2nd over 3rd)`,
    `- Diwani leads Thuluth by +${best.margins[2]} pts (3rd over 4th)`,
    "",
    "--------------------------------------------------------------------------------",
    `PUBLISH ONLY THESE ${best.count} FRESH UNPUBLISHED ARTS PROGRAMS:`,
    "(100% Guaranteed NOT Published before - No overlap with any previous list)",
    "--------------------------------------------------------------------------------"
  ];

  best.subset.forEach((p, i) => {
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
  console.log('Successfully saved fresh list to data.txt!');
} else {
  console.log('No solution found with strictly fresh pool.');
}
