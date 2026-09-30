import { readFileSync } from 'fs';

const raw = JSON.parse(readFileSync('live_data.json', 'utf-8'));
const { teams, programs, results, penalties } = raw;

const activeTeams = teams.filter(t => t.isActive !== false).map(t => t.name); // ["Thuluth", "Reyhani", "Diwani", "Thugra"]
const names = ["Thugra", "Reyhani", "Diwani", "Thuluth"];

// Negative marks
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
  if (norm.includes('sport')) return 'sports';
  if (norm.includes('nonstage')) return 'non-stage';
  if (norm === 'stage' || norm.endsWith('stage')) return 'stage';
  const c = String(p.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (/^[A-Z]*X\d+/.test(c)) return 'non-stage';
  if (/^[A-Z]*Y\d+/.test(c)) return 'stage';
  if (/^[A-Z]*Z\d+/.test(c)) return 'sports';
  if (String(p.section || '').toLowerCase().includes('sport')) return 'sports';
  return 'arts';
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

console.log('Total programs with results:', allWithResults.length);
const currentlyPublished = allWithResults.filter(p => p.isPublished);
const currentlyUnpublished = allWithResults.filter(p => !p.isPublished);

const basePublishedScores = {
  Thugra: -penaltyMap.Thugra,
  Reyhani: -penaltyMap.Reyhani,
  Diwani: -penaltyMap.Diwani,
  Thuluth: -penaltyMap.Thuluth
};
currentlyPublished.forEach(p => {
  names.forEach(n => basePublishedScores[n] += p.pts[n]);
});

console.log('Currently Published Base Scores:', basePublishedScores);

// Let's test Scenario 1: ONLY ADDING (Publishing) a subset of unpublished programs
// We want:
// Thugra > Reyhani
// Reyhani > Diwani
// Reyhani > Thuluth

console.log('\n--- SEARCHING SCENARIO 1: Keep already published, publish subset of unpublished ---');

// Filter unpublished programs that help Thugra / Reyhani more than Diwani / Thuluth
// Let's run a search (Integer Linear Programming or Backtracking / Greedy / Beam Search)
let validSolutionsAddOnly = [];

function searchAddOnly() {
  const unpub = currentlyUnpublished;
  // Let's compute net gains for each unpub program:
  // We need final scores:
  // Thugra - Reyhani > 0
  // Reyhani - Diwani > 0
  // Reyhani - Thuluth > 0
  
  // Let's sort candidate programs by how much they boost Thugra & Reyhani over Diwani & Thuluth
  const candidates = unpub.map((p, idx) => {
    const scoreVal = (p.pts.Thugra * 2 + p.pts.Reyhani * 1.5) - (p.pts.Diwani * 1.5 + p.pts.Thuluth * 1.5);
    return { ...p, origIdx: idx, scoreVal };
  });

  // Let's use randomized / greedy search + local search (Simulated Annealing / Genetic Algorithm / MIP)
  // Let's run 500,000 iterations of random subsets and hill climbing!
  let best = null;
  let minDiffSum = Infinity;

  for (let iter = 0; iter < 200000; iter++) {
    // Pick random subset with probability weighted by scoreVal
    const chosen = [];
    const curScores = { ...basePublishedScores };

    for (const p of candidates) {
      // probability based on whether it helps Thugra or Reyhani
      let prob = 0.5;
      if (p.pts.Thugra > p.pts.Diwani && p.pts.Thugra > p.pts.Thuluth) prob = 0.85;
      else if (p.pts.Reyhani > p.pts.Diwani && p.pts.Reyhani > p.pts.Thuluth) prob = 0.75;
      else if (p.pts.Diwani > p.pts.Thugra + 5 || p.pts.Thuluth > p.pts.Thugra + 5) prob = 0.1;

      if (Math.random() < prob) {
        chosen.push(p);
        names.forEach(n => curScores[n] += p.pts[n]);
      }
    }

    // Check condition
    if (curScores.Thugra > curScores.Reyhani &&
        curScores.Reyhani > curScores.Diwani &&
        curScores.Reyhani > curScores.Thuluth) {
      validSolutionsAddOnly.push({ chosen, scores: curScores });
      if (validSolutionsAddOnly.length >= 10) break;
    }
  }
}

searchAddOnly();
console.log(`Found ${validSolutionsAddOnly.length} solutions for Scenario 1 (Add-only).`);

if (validSolutionsAddOnly.length > 0) {
  validSolutionsAddOnly.slice(0, 3).forEach((sol, i) => {
    console.log(`\nSolution ${i + 1}: Publish ${sol.chosen.length} additional programs:`);
    console.log('Final Scores:', sol.scores);
    console.log('Programs to publish:');
    sol.chosen.forEach(p => console.log(`  - [${p.code}] ${p.name} (${p.section}) -> Thugra:+${p.pts.Thugra}, Reyhani:+${p.pts.Reyhani}, Diwani:+${p.pts.Diwani}, Thuluth:+${p.pts.Thuluth}`));
  });
}

// Scenario 2: What if we start from a minimal set or select from ALL programs (publishing / unpublishing)?
