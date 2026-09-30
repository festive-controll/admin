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

// Exact current standings from user's live screen screenshot:
const liveScreenScores = {
  Diwani: 458,
  Reyhani: 441,
  Thugra: 441,
  Thuluth: 428
};

console.log('Starting from exact screen scores:', liveScreenScores);

// Available unpublished Arts programs
const unpub = allArts.filter(p => !p.isPublished);
console.log('Unpublished Arts programs count:', unpub.length);

// We need:
// 1. Reyhani > Thugra
// 2. Thugra > Diwani (Thugra needs +18 pts more than Diwani to overtake 458)
// 3. Diwani > Thuluth
//
// Target order: Reyhani (1st) > Thugra (2nd) > Diwani (3rd) > Thuluth (4th)

let bestSolutions = [];
let minCount = 999;

for (let iter = 0; iter < 1000000; iter++) {
  const subset = [];
  const test = { ...liveScreenScores };

  for (const p of unpub) {
    // Steer towards high Thugra (to beat Diwani), high Reyhani (to beat Thugra), low Diwani, low Thuluth
    let prob = 0.25;
    if (p.pts.Thugra >= 10 && p.pts.Diwani === 0 && p.pts.Thuluth === 0) prob = 0.95;
    else if (p.pts.Reyhani >= 10 && p.pts.Diwani === 0 && p.pts.Thuluth === 0) prob = 0.90;
    else if (p.pts.Thugra >= 8 && p.pts.Diwani <= 3) prob = 0.80;
    else if (p.pts.Diwani >= 8 || p.pts.Thuluth >= 8) prob = 0.02;

    if (Math.random() < prob) {
      subset.push(p);
      names.forEach(n => test[n] += p.pts[n]);
    }
  }

  // Check strict ranking: Reyhani > Thugra > Diwani > Thuluth
  if (test.Reyhani > test.Thugra && test.Thugra > test.Diwani && test.Diwani > test.Thuluth) {
    const m1 = test.Reyhani - test.Thugra;
    const m2 = test.Thugra - test.Diwani;
    const m3 = test.Diwani - test.Thuluth;
    const minMargin = Math.min(m1, m2, m3);

    if (subset.length < minCount) {
      minCount = subset.length;
      bestSolutions = [{ count: subset.length, scores: test, margins: [m1, m2, m3], minMargin, subset }];
    } else if (subset.length === minCount) {
      if (minMargin > bestSolutions[0].minMargin) {
        bestSolutions = [{ count: subset.length, scores: test, margins: [m1, m2, m3], minMargin, subset }];
      }
    }
  }
}

if (bestSolutions.length > 0) {
  const sol = bestSolutions[0];
  console.log('\n--- FINAL OPTIMAL SOLUTION ---');
  console.log('Count:', sol.count);
  console.log('Scores:', sol.scores);
  console.log('Margins:', sol.margins);

  const lines = [
    "================================================================================",
    `EXACT PROGRAMS TO CLICK 'PUBLISH' (ONLY ${sol.count} PROGRAMS)`,
    "TO SET FINAL STANDINGS: 1-Reyhani, 2-Thugra, 3-Diwani, 4-Thuluth",
    "================================================================================",
    "",
    "Current Standings (from your live screen):",
    `• Diwani   : ${liveScreenScores.Diwani} pts (Currently 1st)`,
    `• Reyhani  : ${liveScreenScores.Reyhani} pts (Currently 2nd)`,
    `• Thugra   : ${liveScreenScores.Thugra} pts (Currently 2nd)`,
    `• Thuluth  : ${liveScreenScores.Thuluth} pts (Currently 4th)`,
    "",
    "Target Final Standings (After clicking Publish on the programs below):",
    `1. Reyhani  : ${sol.scores.Reyhani} Points (🥇 1st Position - Champion)`,
    `2. Thugra   : ${sol.scores.Thugra} Points (🥈 2nd Position - Runner-up)`,
    `3. Diwani   : ${sol.scores.Diwani} Points (🥉 3rd Position)`,
    `4. Thuluth  : ${sol.scores.Thuluth} Points (4th Position)`,
    "",
    "Safety Lead Margins:",
    `- Reyhani leads Thugra by +${sol.margins[0]} pts (1st over 2nd)`,
    `- Thugra leads Diwani by +${sol.margins[1]} pts (2nd over 3rd)`,
    `- Diwani leads Thuluth by +${sol.margins[2]} pts (3rd over 4th)`,
    "",
    "--------------------------------------------------------------------------------",
    `PUBLISH THESE ${sol.count} ARTS PROGRAMS ON THE PUBLISH PAGE`,
    "(Strictly Stage and Non-Stage Arts programs only - No Sports)",
    "--------------------------------------------------------------------------------"
  ];

  sol.subset.forEach((p, i) => {
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
  console.log('Updated data.txt successfully!');
} else {
  console.log('No solution found in iteration range.');
}
