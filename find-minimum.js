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

const allArts = [];
programs.forEach(p => {
  const pResults = resultsByProgram.get(p.id) || [];
  if (pResults.length === 0) return;

  const cat = resolveCategory(p);
  if (cat === 'Sports') return; // Arts only

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

const baseScores = { Thugra: 0, Reyhani: 0, Diwani: 0, Thuluth: 0 };
publishedArts.forEach(p => {
  names.forEach(n => baseScores[n] += p.pts[n]);
});

console.log('Published Base Arts Scores:', baseScores);
console.log('Unpublished Arts available:', unpublishedArts.length);

// Differences needed:
// Current:
// Thuluth: 368, Diwani: 338, Reyhani: 282, Thugra: 195
// We need subset S of unpublished arts such that:
// final.Thugra > final.Reyhani
// final.Reyhani > final.Diwani
// final.Reyhani > final.Thuluth

// Let's filter unpublished arts that contribute positively to (Thugra - Diwani), (Thugra - Thuluth), (Reyhani - Diwani), (Reyhani - Thuluth)
// Rank programs by power
const pool = unpublishedArts.map(p => {
  const boost = (p.pts.Thugra + p.pts.Reyhani) - (p.pts.Diwani + p.pts.Thuluth);
  return { ...p, boost };
});

// Sort pool by boost descending
pool.sort((a, b) => b.boost - a.boost);

console.log('Top boosting programs:', pool.slice(0, 10).map(p => `[${p.code}] ${p.name}: +${p.pts.Thugra}T, +${p.pts.Reyhani}R, +${p.pts.Diwani}D, +${p.pts.Thuluth}Th`));

// Exact Branch and Bound search for minimum size K
let minSolution = null;

for (let targetSize = 1; targetSize <= 35; targetSize++) {
  console.log(`Checking size K = ${targetSize}...`);
  const chosen = [];
  
  function dfs(startIndex, left, curScores) {
    if (minSolution) return true;
    if (left === 0) {
      if (curScores.Thugra > curScores.Reyhani &&
          curScores.Reyhani > curScores.Diwani &&
          curScores.Reyhani > curScores.Thuluth) {
        minSolution = { size: chosen.length, chosen: [...chosen], scores: { ...curScores } };
        return true;
      }
      return false;
    }

    if (pool.length - startIndex < left) return false;

    // Pruning: max possible gain from remaining top `left` programs
    const remaining = pool.slice(startIndex);
    const maxThugraGain = remaining.map(p => p.pts.Thugra).sort((a,b)=>b-a).slice(0, left).reduce((a,b)=>a+b, 0);
    const maxReyhaniGain = remaining.map(p => p.pts.Reyhani).sort((a,b)=>b-a).slice(0, left).reduce((a,b)=>a+b, 0);

    // If even with max gains we cannot exceed Diwani/Thuluth base:
    if (curScores.Thugra + maxThugraGain <= curScores.Reyhani) {
      // Thugra still might overtake Reyhani if Reyhani gains less, so check Thugra vs Diwani/Thuluth
    }
    if (curScores.Reyhani + maxReyhaniGain <= curScores.Diwani || curScores.Reyhani + maxReyhaniGain <= curScores.Thuluth) {
      return false;
    }

    for (let i = startIndex; i <= pool.length - left; i++) {
      const p = pool[i];
      chosen.push(p);
      const nextScores = {
        Thugra: curScores.Thugra + p.pts.Thugra,
        Reyhani: curScores.Reyhani + p.pts.Reyhani,
        Diwani: curScores.Diwani + p.pts.Diwani,
        Thuluth: curScores.Thuluth + p.pts.Thuluth
      };
      const found = dfs(i + 1, left - 1, nextScores);
      chosen.pop();
      if (found) return true;
    }
    return false;
  }

  dfs(0, targetSize, baseScores);
  if (minSolution) {
    console.log(`\n>>> FOUND MINIMUM SOLUTION WITH K = ${minSolution.size} PROGRAMS! <<<`);
    break;
  }
}

if (minSolution) {
  console.log('Minimum Final Scores:', minSolution.scores);
  console.log('Programs to publish:');
  minSolution.chosen.forEach((p, i) => {
    console.log(`${i + 1}. [${p.code}] ${p.name} (${p.section}, ${p.category}): +${p.pts.Thugra} Thugra, +${p.pts.Reyhani} Reyhani, +${p.pts.Diwani} Diwani, +${p.pts.Thuluth} Thuluth`);
  });

  const margins = [
    minSolution.scores.Thugra - minSolution.scores.Reyhani,
    minSolution.scores.Reyhani - minSolution.scores.Diwani,
    minSolution.scores.Reyhani - minSolution.scores.Thuluth
  ];

  const dataTxtContent = `================================================================================
MINIMUM LIST OF ARTS PROGRAMS TO CLICK 'PUBLISH' (ONLY ${minSolution.size} PROGRAMS)
TO SET THUGRA 1st POSITION & REYHANI 2nd POSITION IN ARTS
================================================================================

Arts Final Standings (Smallest Count to Publish):
1. Thugra   : ${minSolution.scores.Thugra} Points (1st Position - Rank 1)
2. Reyhani  : ${minSolution.scores.Reyhani} Points (2nd Position - Rank 2)
3. Thuluth  : ${minSolution.scores.Thuluth} Points
4. Diwani   : ${minSolution.scores.Diwani} Points

Lead Margins:
- Thugra leads Reyhani by +${margins[0]} pts
- Reyhani leads Thuluth by +${margins[2]} pts
- Reyhani leads Diwani by +${margins[1]} pts

Current Published Arts Base Standings:
- Thuluth : ${baseScores.Thuluth} pts
- Diwani  : ${baseScores.Diwani} pts
- Reyhani : ${baseScores.Reyhani} pts
- Thugra  : ${baseScores.Thugra} pts

--------------------------------------------------------------------------------
MINIMUM ${minSolution.size} ARTS PROGRAMS TO CLICK 'PUBLISH' ON THE PUBLISH PAGE
(Strictly Stage and Non-Stage Arts programs only - No Sports)
--------------------------------------------------------------------------------
${minSolution.chosen.map((p, i) => `${(i + 1).toString().padStart(2, ' ')}. [${p.code}] ${p.name.padEnd(30, ' ')} | Section: ${p.section.padEnd(12, ' ')} | Category: ${p.category.padEnd(10, ' ')} | (+${p.pts.Thugra} Thugra, +${p.pts.Reyhani} Reyhani, +${p.pts.Diwani} Diwani, +${p.pts.Thuluth} Thuluth)`).join('\n')}

================================================================================
`;

  writeFileSync('d:/penmdrive/artfest/fest_managment-main/data.txt', dataTxtContent);
  console.log('\nWrote minimum list to data.txt successfully!');
}
