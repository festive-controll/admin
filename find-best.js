import { readFileSync, writeFileSync } from 'fs';

const raw = JSON.parse(readFileSync('live_data.json', 'utf-8'));
const { teams, programs, results, penalties } = raw;

const names = ["Thugra", "Reyhani", "Diwani", "Thuluth"];

const penaltyMap = { Thugra: 0, Reyhani: 0, Diwani: 0, Thuluth: 0 };
penalties.filter(p => p.status === 'Active' || p.status === undefined).forEach(p => {
  const marks = Number(p.marks) || 0;
  const targetTeams = Array.isArray(p.teams) ? p.teams : [p.team].filter(Boolean);
  targetTeams.forEach(t => {
    const match = names.find(n => n.toLowerCase() === String(t).toLowerCase());
    if (match) penaltyMap[match] += marks;
  });
});

const resultsByProgram = new Map();
results.forEach(r => {
  if (!r.programId) return;
  if (!resultsByProgram.has(r.programId)) resultsByProgram.set(r.programId, []);
  resultsByProgram.get(r.programId).push(r);
});

function getPoints(r) {
  for (const k of ['totalPoints', 'points', 'score']) {
    if (r[k] !== undefined && r[k] !== null && r[k] !== '' && Number.isFinite(Number(r[k]))) {
      return Number(r[k]);
    }
  }
  return (Number(r.gradePoints) || 0) + (Number(r.positionPoints) || 0);
}

function resolveCategory(p) {
  const rawType = [p.venueTypeName, p.venueType, p.venue_type, p.category]
    .find(v => typeof v === 'string' && v.trim());
  const norm = String(rawType || '').toLowerCase().replace(/[\s_-]+/g, '');
  if (norm.includes('sport')) return 'Sports';
  if (norm.includes('nonstage')) return 'Non-Stage';
  if (norm === 'stage' || norm.endsWith('stage')) return 'Stage';
  const c = String(p.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (/^[A-Z]*X\d+/.test(c)) return 'Non-Stage';
  if (/^[A-Z]*Y\d+/.test(c)) return 'Stage';
  if (/^[A-Z]*Z\d+/.test(c)) return 'Sports';
  return 'General';
}

const allWithResults = [];
programs.forEach(p => {
  const pResults = resultsByProgram.get(p.id) || [];
  if (pResults.length === 0) return;

  const pts = { Thugra: 0, Reyhani: 0, Diwani: 0, Thuluth: 0 };
  pResults.forEach(r => {
    const teamName = r.team || r.teamName;
    const match = names.find(n => n.toLowerCase() === String(teamName).toLowerCase());
    if (match) pts[match] += getPoints(r);
  });

  allWithResults.push({
    id: p.id,
    code: p.code || '',
    name: p.name || '',
    section: p.section || '',
    category: resolveCategory(p),
    isPublished: p.resultsPublished === true,
    pts
  });
});

const currentlyPublished = allWithResults.filter(p => p.isPublished);
const currentlyUnpublished = allWithResults.filter(p => !p.isPublished);

const baseScores = {
  Thugra: -penaltyMap.Thugra,
  Reyhani: -penaltyMap.Reyhani,
  Diwani: -penaltyMap.Diwani,
  Thuluth: -penaltyMap.Thuluth
};
currentlyPublished.forEach(p => {
  names.forEach(n => baseScores[n] += p.pts[n]);
});

console.log('Current Published Base Scores:', baseScores);

// Find several distinct high quality solutions:
// Target:
// 1. Thugra >= Reyhani + 5
// 2. Reyhani >= Diwani + 5
// 3. Reyhani >= Thuluth + 5

const pool = currentlyUnpublished;

let solutions = [];
for (let iter = 0; iter < 500000; iter++) {
  const subset = [];
  const cur = { ...baseScores };

  for (const p of pool) {
    // calculate priority
    const gainThugra = p.pts.Thugra - Math.max(p.pts.Diwani, p.pts.Thuluth);
    const gainReyhani = p.pts.Reyhani - Math.max(p.pts.Diwani, p.pts.Thuluth);
    
    let prob = 0.3;
    if (p.pts.Thugra >= 10 && p.pts.Diwani <= 4 && p.pts.Thuluth <= 4) prob = 0.95;
    else if (p.pts.Reyhani >= 10 && p.pts.Diwani <= 4 && p.pts.Thuluth <= 4) prob = 0.85;
    else if (gainThugra > 0 || gainReyhani > 0) prob = 0.65;
    else if (p.pts.Diwani >= 8 || p.pts.Thuluth >= 8) prob = 0.05;

    if (Math.random() < prob) {
      subset.push(p);
      names.forEach(n => cur[n] += p.pts[n]);
    }
  }

  const margin1 = cur.Thugra - cur.Reyhani;
  const margin2 = cur.Reyhani - cur.Diwani;
  const margin3 = cur.Reyhani - cur.Thuluth;

  if (margin1 >= 5 && margin2 >= 5 && margin3 >= 5) {
    solutions.push({
      count: subset.length,
      scores: cur,
      margins: [margin1, margin2, margin3],
      minMargin: Math.min(margin1, margin2, margin3),
      subset
    });
  }
}

// Sort by minMargin descending and count
solutions.sort((a, b) => b.minMargin - a.minMargin || a.count - b.count);

console.log(`Found ${solutions.length} robust solutions with >= 5 pt safety margins!`);

const best = solutions[0];
console.log('\n--- BEST SOLUTION ---');
console.log('Final Scores:', best.scores);
console.log(`Margins: Thugra > Reyhani by +${best.margins[0]}, Reyhani > Diwani by +${best.margins[1]}, Reyhani > Thuluth by +${best.margins[2]}`);
console.log(`Programs to Publish (${best.subset.length}):`);
best.subset.forEach((p, i) => {
  console.log(`${i + 1}. [${p.code}] ${p.name} | Section: ${p.section} | Category: ${p.category} (Thugra:+${p.pts.Thugra}, Reyhani:+${p.pts.Reyhani}, Diwani:+${p.pts.Diwani}, Thuluth:+${p.pts.Thuluth})`);
});

// Let's write the result directly to data.txt and json
const dataTxtContent = `================================================================================
LIST OF PROGRAMS TO CLICK 'PUBLISH' (TO SET THUGRA 1st & REYHANI 2nd)
================================================================================

Target Standings:
1. Thugra   : ${best.scores.Thugra} Points (1st Position - Rank 1)
2. Reyhani  : ${best.scores.Reyhani} Points (2nd Position - Rank 2)
3. Diwani   : ${best.scores.Diwani} Points
4. Thuluth  : ${best.scores.Thuluth} Points

Safety Lead Margins:
- Thugra leads Reyhani by +${best.margins[0]} pts
- Reyhani leads Diwani by +${best.margins[1]} pts
- Reyhani leads Thuluth by +${best.margins[2]} pts

Current Base Standings (Already Published):
- Thuluth : ${baseScores.Thuluth} pts
- Diwani  : ${baseScores.Diwani} pts
- Reyhani : ${baseScores.Reyhani} pts
- Thugra  : ${baseScores.Thugra} pts

--------------------------------------------------------------------------------
PROGRAMS TO CLICK 'PUBLISH' ON THE PUBLISH PAGE (${best.subset.length} Programs)
--------------------------------------------------------------------------------
${best.subset.map((p, i) => `${(i + 1).toString().padStart(2, ' ')}. [${p.code}] ${p.name.padEnd(30, ' ')} | Section: ${p.section.padEnd(12, ' ')} | Category: ${p.category.padEnd(10, ' ')} | (+${p.pts.Thugra} Thugra, +${p.pts.Reyhani} Reyhani, +${p.pts.Diwani} Diwani, +${p.pts.Thuluth} Thuluth)`).join('\n')}

================================================================================
`;

writeFileSync('d:/penmdrive/artfest/fest_managment-main/data.txt', dataTxtContent);
console.log('\nWrote result to data.txt successfully!');
