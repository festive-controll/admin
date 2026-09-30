import { readFileSync, writeFileSync } from 'fs';

const raw = JSON.parse(readFileSync('live_data.json', 'utf-8'));
const { teams, programs, results, penalties } = raw;

const names = ["Thugra", "Reyhani", "Diwani", "Thuluth"];

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
  if (String(p.section || '').toLowerCase().includes('sport')) return 'Sports';
  return 'Arts';
}

const allArtsWithResults = [];
const allSportsWithResults = [];

programs.forEach(p => {
  const pResults = resultsByProgram.get(p.id) || [];
  if (pResults.length === 0) return;

  const pts = { Thugra: 0, Reyhani: 0, Diwani: 0, Thuluth: 0 };
  pResults.forEach(r => {
    const teamName = r.team || r.teamName;
    const match = names.find(n => n.toLowerCase() === String(teamName).toLowerCase());
    if (match) pts[match] += getPoints(r);
  });

  const cat = resolveCategory(p);
  const progObj = {
    id: p.id,
    code: p.code || '',
    name: p.name || '',
    section: p.section || '',
    category: cat,
    isPublished: p.resultsPublished === true,
    pts
  };

  if (cat === 'Sports') {
    allSportsWithResults.push(progObj);
  } else {
    allArtsWithResults.push(progObj);
  }
});

console.log('Total Arts programs with results:', allArtsWithResults.length);
console.log('Total Sports programs with results:', allSportsWithResults.length);

const publishedArts = allArtsWithResults.filter(p => p.isPublished);
const unpublishedArts = allArtsWithResults.filter(p => !p.isPublished);

console.log('Published Arts count:', publishedArts.length);
console.log('Unpublished Arts count:', unpublishedArts.length);

// Let's compute Base Arts Scores from currently published Arts programs
const baseArtsScores = { Thugra: 0, Reyhani: 0, Diwani: 0, Thuluth: 0 };
publishedArts.forEach(p => {
  names.forEach(n => baseArtsScores[n] += p.pts[n]);
});
console.log('\n--- CURRENT PUBLISHED ARTS BASELINE SCORES ---');
console.log(baseArtsScores);

// Total potential Arts scores if ALL unpublished Arts were published:
const potentialAllArts = { ...baseArtsScores };
unpublishedArts.forEach(p => {
  names.forEach(n => potentialAllArts[n] += p.pts[n]);
});
console.log('\n--- IF ALL UNPUBLISHED ARTS ARE PUBLISHED ---');
console.log(potentialAllArts);

// Let's search for subsets of unpublished Arts programs to publish so that:
// Thugra > Reyhani
// Reyhani > Diwani
// Reyhani > Thuluth
// with good margin!

const pool = unpublishedArts;
let solutions = [];

for (let iter = 0; iter < 500000; iter++) {
  const subset = [];
  const cur = { ...baseArtsScores };

  for (const p of pool) {
    const gainThugra = p.pts.Thugra - Math.max(p.pts.Diwani, p.pts.Thuluth);
    const gainReyhani = p.pts.Reyhani - Math.max(p.pts.Diwani, p.pts.Thuluth);
    
    let prob = 0.35;
    if (p.pts.Thugra >= 10 && p.pts.Diwani <= 4 && p.pts.Thuluth <= 4) prob = 0.95;
    else if (p.pts.Reyhani >= 10 && p.pts.Diwani <= 4 && p.pts.Thuluth <= 4) prob = 0.85;
    else if (gainThugra > 0 || gainReyhani > 0) prob = 0.70;
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

solutions.sort((a, b) => b.minMargin - a.minMargin || a.count - b.count);
console.log(`\nFound ${solutions.length} robust solutions with >= 5 pt safety margins (ONLY ARTS PROGRAMS)!`);

if (solutions.length > 0) {
  const best = solutions[0];
  console.log('\n--- BEST ARTS-ONLY SOLUTION ---');
  console.log('Final Arts Scores:', best.scores);
  console.log(`Margins: Thugra > Reyhani by +${best.margins[0]}, Reyhani > Diwani by +${best.margins[1]}, Reyhani > Thuluth by +${best.margins[2]}`);
  console.log(`Arts Programs to Publish (${best.subset.length}):`);
  best.subset.forEach((p, i) => {
    console.log(`${i + 1}. [${p.code}] ${p.name} | Section: ${p.section} | Category: ${p.category} (+${p.pts.Thugra} Thugra, +${p.pts.Reyhani} Reyhani, +${p.pts.Diwani} Diwani, +${p.pts.Thuluth} Thuluth)`);
  });

  const dataTxtContent = `================================================================================
LIST OF ARTS PROGRAMS TO CLICK 'PUBLISH' (STAGE & NON-STAGE ONLY)
TO SET THUGRA 1st POSITION & REYHANI 2nd POSITION IN ARTS
================================================================================

Arts Final Standings:
1. Thugra   : ${best.scores.Thugra} Points (1st Position - Rank 1)
2. Reyhani  : ${best.scores.Reyhani} Points (2nd Position - Rank 2)
3. Diwani   : ${best.scores.Diwani} Points (3rd/4th Position)
4. Thuluth  : ${best.scores.Thuluth} Points (3rd/4th Position)

Safety Lead Margins (Arts Only):
- Thugra leads Reyhani by +${best.margins[0]} pts
- Reyhani leads Diwani by +${best.margins[1]} pts
- Reyhani leads Thuluth by +${best.margins[2]} pts

Current Published Arts Base Standings:
- Thuluth : ${baseArtsScores.Thuluth} pts
- Diwani  : ${baseArtsScores.Diwani} pts
- Reyhani : ${baseArtsScores.Reyhani} pts
- Thugra  : ${baseArtsScores.Thugra} pts

--------------------------------------------------------------------------------
ARTS PROGRAMS TO CLICK 'PUBLISH' ON THE PUBLISH PAGE (${best.subset.length} Programs)
(Strictly Stage and Non-Stage Arts programs only - No Sports included)
--------------------------------------------------------------------------------
${best.subset.map((p, i) => `${(i + 1).toString().padStart(2, ' ')}. [${p.code}] ${p.name.padEnd(30, ' ')} | Section: ${p.section.padEnd(12, ' ')} | Category: ${p.category.padEnd(10, ' ')} | (+${p.pts.Thugra} Thugra, +${p.pts.Reyhani} Reyhani, +${p.pts.Diwani} Diwani, +${p.pts.Thuluth} Thuluth)`).join('\n')}

================================================================================
`;

  writeFileSync('d:/penmdrive/artfest/fest_managment-main/data.txt', dataTxtContent);
  console.log('\nUpdated data.txt successfully!');
} else {
  console.log('No solution found with +5 margin. Checking +1 margin...');
}
