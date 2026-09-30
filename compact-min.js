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

const filteredPool = unpublishedArts.filter(p => {
  return (p.pts.Thugra > 0 || p.pts.Reyhani > 0) && (p.pts.Diwani + p.pts.Thuluth <= p.pts.Thugra + p.pts.Reyhani + 6);
});

let bestWithMargin = null;

for (let iter = 0; iter < 1000000; iter++) {
  const size = 18 + Math.floor(Math.random() * 12);
  const subset = [];
  const cur = { ...base };

  const chosenIndices = new Set();
  while (chosenIndices.size < size) {
    const idx = Math.min(filteredPool.length - 1, Math.floor(Math.abs(Math.random() - Math.random()) * filteredPool.length));
    chosenIndices.add(idx);
  }

  for (const idx of chosenIndices) {
    const p = filteredPool[idx];
    subset.push(p);
    names.forEach(n => cur[n] += p.pts[n]);
  }

  // Margin >= 3
  if (cur.Thugra >= cur.Reyhani + 3 && cur.Reyhani >= cur.Diwani + 4 && cur.Reyhani >= cur.Thuluth + 4) {
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
        if (testScores.Thugra >= testScores.Reyhani + 3 && testScores.Reyhani >= testScores.Diwani + 4 && testScores.Reyhani >= testScores.Thuluth + 4) {
          reducedSubset.splice(i, 1);
          reducedScores = testScores;
          changed = true;
          break;
        }
      }
    }

    if (!bestWithMargin || reducedSubset.length < bestWithMargin.count) {
      bestWithMargin = {
        count: reducedSubset.length,
        subset: reducedSubset,
        scores: reducedScores
      };
      console.log(`>>> Found small solution with safe margins: ${reducedSubset.length} programs! Scores:`, reducedScores);
    }
  }
}

if (bestWithMargin) {
  const margins = [
    bestWithMargin.scores.Thugra - bestWithMargin.scores.Reyhani,
    bestWithMargin.scores.Reyhani - bestWithMargin.scores.Thuluth,
    bestWithMargin.scores.Reyhani - bestWithMargin.scores.Diwani
  ];

  const dataTxtContent = `================================================================================
MINIMUM COMPACT LIST OF ARTS PROGRAMS TO CLICK 'PUBLISH' (${bestWithMargin.count} PROGRAMS)
TO SET THUGRA 1st POSITION & REYHANI 2nd POSITION IN ARTS
================================================================================

Arts Final Standings (Only ${bestWithMargin.count} Programs to Publish):
1. Thugra   : ${bestWithMargin.scores.Thugra} Points (1st Position - Rank 1)
2. Reyhani  : ${bestWithMargin.scores.Reyhani} Points (2nd Position - Rank 2)
3. Thuluth  : ${bestWithMargin.scores.Thuluth} Points (3rd Position)
4. Diwani   : ${bestWithMargin.scores.Diwani} Points (4th Position)

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
COMPACT ${bestWithMargin.count} ARTS PROGRAMS TO CLICK 'PUBLISH' ON THE PUBLISH PAGE
(Strictly Stage and Non-Stage Arts programs only - No Sports)
--------------------------------------------------------------------------------
${bestWithMargin.subset.map((p, i) => `${(i + 1).toString().padStart(2, ' ')}. [${p.code}] ${p.name.padEnd(30, ' ')} | Section: ${p.section.padEnd(12, ' ')} | Category: ${p.category.padEnd(10, ' ')} | (+${p.pts.Thugra} Thugra, +${p.pts.Reyhani} Reyhani, +${p.pts.Diwani} Diwani, +${p.pts.Thuluth} Thuluth)`).join('\n')}

================================================================================
`;

  writeFileSync('d:/penmdrive/artfest/fest_managment-main/data.txt', dataTxtContent);
  console.log('\nUpdated data.txt successfully!');
}
