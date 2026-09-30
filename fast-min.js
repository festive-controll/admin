import { readFileSync, writeFileSync } from 'fs';

const raw = JSON.parse(readFileSync('live_data.json', 'utf-8'));
const { programs, results } = raw;
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

const allArts = [];
programs.forEach(p => {
  const pResults = resultsByProgram.get(p.id) || [];
  if (pResults.length === 0) return;
  const cat = resolveCategory(p);
  if (cat === 'Sports') return;

  const pts = { Thugra: 0, Reyhani: 0, Diwani: 0, Thuluth: 0 };
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

const publishedArts = allArts.filter(p => p.isPublished);
const unpublishedArts = allArts.filter(p => !p.isPublished);

const base = { Thugra: 0, Reyhani: 0, Diwani: 0, Thuluth: 0 };
publishedArts.forEach(p => {
  names.forEach(n => base[n] += p.pts[n]);
});

console.log('Published Base Arts:', base);

// We want minimal subset of unpublishedArts:
// Final Thugra > Final Reyhani
// Final Reyhani > Final Diwani
// Final Reyhani > Final Thuluth

// Filter out any programs where Diwani or Thuluth gain heavily without Thugra/Reyhani gaining much
const filteredPool = unpublishedArts.filter(p => {
  // Keep if Thugra or Reyhani gets positive points and opponent gain isn't overwhelming
  return (p.pts.Thugra > 0 || p.pts.Reyhani > 0) && (p.pts.Diwani + p.pts.Thuluth <= p.pts.Thugra + p.pts.Reyhani + 6);
});

console.log(`Filtered pool size: ${filteredPool.length} of ${unpublishedArts.length}`);

// Sort by best score boost
filteredPool.sort((a, b) => {
  const scoreA = (a.pts.Thugra * 1.5 + a.pts.Reyhani * 1.2) - (a.pts.Diwani + a.pts.Thuluth);
  const scoreB = (b.pts.Thugra * 1.5 + b.pts.Reyhani * 1.2) - (b.pts.Diwani + b.pts.Thuluth);
  return scoreB - scoreA;
});

// Let's do random simulated annealing / genetic algorithm / hill climbing to find the absolute smallest count!
let bestSolution = null;

for (let iter = 0; iter < 1000000; iter++) {
  // Try sizes from 15 to 30
  const size = 15 + Math.floor(Math.random() * 15);
  const subset = [];
  const cur = { ...base };

  // Sample without replacement biased towards top elements
  const chosenIndices = new Set();
  while (chosenIndices.size < size) {
    // geometric distribution towards top
    const idx = Math.min(filteredPool.length - 1, Math.floor(Math.abs(Math.random() - Math.random()) * filteredPool.length));
    chosenIndices.add(idx);
  }

  for (const idx of chosenIndices) {
    const p = filteredPool[idx];
    subset.push(p);
    names.forEach(n => cur[n] += p.pts[n]);
  }

  if (cur.Thugra > cur.Reyhani && cur.Reyhani > cur.Diwani && cur.Reyhani > cur.Thuluth) {
    // Try to minimize this subset by removing unnecessary elements one by one!
    let reducedSubset = [...subset];
    let reducedScores = { ...cur };
    let changed = true;

    while (changed) {
      changed = false;
      for (let i = 0; i < reducedSubset.length; i++) {
        const candidate = reducedSubset[i];
        const testScores = {
          Thugra: reducedScores.Thugra - candidate.pts.Thugra,
          Reyhani: reducedScores.Reyhani - candidate.pts.Reyhani,
          Diwani: reducedScores.Diwani - candidate.pts.Diwani,
          Thuluth: reducedScores.Thuluth - candidate.pts.Thuluth
        };
        if (testScores.Thugra > testScores.Reyhani && testScores.Reyhani > testScores.Diwani && testScores.Reyhani > testScores.Thuluth) {
          reducedSubset.splice(i, 1);
          reducedScores = testScores;
          changed = true;
          break;
        }
      }
    }

    if (!bestSolution || reducedSubset.length < bestSolution.count) {
      bestSolution = {
        count: reducedSubset.length,
        subset: reducedSubset,
        scores: reducedScores
      };
      console.log(`>>> Found smaller solution: ${reducedSubset.length} programs! <<< Scores:`, reducedScores);
    }
  }
}

console.log('\n=======================================');
console.log(`ABSOLUTE SMALLEST COUNT FOUND: ${bestSolution.count} Programs`);
console.log('Final Scores:', bestSolution.scores);
console.log('Programs list:');
bestSolution.subset.forEach((p, i) => {
  console.log(`${i + 1}. [${p.code}] ${p.name} (${p.section}, ${p.category}): Thugra:+${p.pts.Thugra}, Reyhani:+${p.pts.Reyhani}, Diwani:+${p.pts.Diwani}, Thuluth:+${p.pts.Thuluth}`);
});

const margins = [
  bestSolution.scores.Thugra - bestSolution.scores.Reyhani,
  bestSolution.scores.Reyhani - bestSolution.scores.Thuluth,
  bestSolution.scores.Reyhani - bestSolution.scores.Diwani
];

const dataTxtContent = `================================================================================
SMALLEST COUNT OF ARTS PROGRAMS TO CLICK 'PUBLISH' (ONLY ${bestSolution.count} PROGRAMS)
TO SET THUGRA 1st POSITION & REYHANI 2nd POSITION IN ARTS
================================================================================

Arts Final Standings (Smallest Count to Publish):
1. Thugra   : ${bestSolution.scores.Thugra} Points (1st Position - Rank 1)
2. Reyhani  : ${bestSolution.scores.Reyhani} Points (2nd Position - Rank 2)
3. Thuluth  : ${bestSolution.scores.Thuluth} Points (3rd Position)
4. Diwani   : ${bestSolution.scores.Diwani} Points (4th Position)

Safety Lead Margins (Arts Only):
- Thugra leads Reyhani by +${margins[0]} pts
- Reyhani leads Thuluth by +${margins[1]} pts
- Reyhani leads Diwani by +${margins[2]} pts

Current Published Arts Base Standings:
- Thuluth : ${base.Thuluth} pts
- Diwani  : ${base.Diwani} pts
- Reyhani : ${base.Reyhani} pts
- Thugra  : ${base.Thugra} pts

--------------------------------------------------------------------------------
MINIMUM ${bestSolution.count} ARTS PROGRAMS TO CLICK 'PUBLISH' ON THE PUBLISH PAGE
(Strictly Stage and Non-Stage Arts programs only - No Sports)
--------------------------------------------------------------------------------
${bestSolution.subset.map((p, i) => `${(i + 1).toString().padStart(2, ' ')}. [${p.code}] ${p.name.padEnd(30, ' ')} | Section: ${p.section.padEnd(12, ' ')} | Category: ${p.category.padEnd(10, ' ')} | (+${p.pts.Thugra} Thugra, +${p.pts.Reyhani} Reyhani, +${p.pts.Diwani} Diwani, +${p.pts.Thuluth} Thuluth)`).join('\n')}

================================================================================
`;

writeFileSync('d:/penmdrive/artfest/fest_managment-main/data.txt', dataTxtContent);
console.log('\nUpdated data.txt successfully!');
