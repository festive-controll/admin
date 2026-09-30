import { readFileSync, writeFileSync } from 'fs';

const raw = JSON.parse(readFileSync('live_data.json', 'utf-8'));
const { teams, programs, results, penalties, sections } = raw;

console.log('--- BASIC STATS ---');
console.log('Teams count:', teams.length);
console.log('Teams:', teams.map(t => ({ id: t.id, name: t.name, isActive: t.isActive })));
console.log('Programs count:', programs.length);
console.log('Results count:', results.length);
console.log('Penalties count:', penalties.length);

// Check active teams
const activeTeams = teams.filter(t => t.isActive !== false).map(t => t.name);
console.log('Active teams:', activeTeams);

// Negative marks per team
const penaltyMap = {};
activeTeams.forEach(t => penaltyMap[t] = 0);
penalties.filter(p => p.status === 'Active' || p.status === undefined).forEach(p => {
  const marks = Number(p.marks) || 0;
  const targetTeams = Array.isArray(p.teams) ? p.teams : [p.team].filter(Boolean);
  targetTeams.forEach(t => {
    const match = activeTeams.find(at => at.toLowerCase() === String(t).toLowerCase());
    if (match) penaltyMap[match] += marks;
  });
});
console.log('Penalties per team:', penaltyMap);

// Map results to programs
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

// Calculate team points per program
const programsWithResults = [];
programs.forEach(p => {
  const pResults = resultsByProgram.get(p.id) || [];
  if (pResults.length === 0) return;

  const teamPts = {};
  activeTeams.forEach(t => teamPts[t] = 0);

  pResults.forEach(r => {
    const teamName = r.team || r.teamName;
    const match = activeTeams.find(at => at.toLowerCase() === String(teamName).toLowerCase());
    if (match) {
      teamPts[match] += getPoints(r);
    }
  });

  const category = resolveCategory(p);
  const isPublished = p.resultsPublished === true;

  programsWithResults.push({
    id: p.id,
    code: p.code,
    name: p.name,
    section: p.section,
    category,
    isPublished,
    teamPts,
    resultsCount: pResults.length
  });
});

console.log('Total programs with results entered:', programsWithResults.length);
console.log('Published programs with results:', programsWithResults.filter(p => p.isPublished).length);
console.log('Unpublished programs with results:', programsWithResults.filter(p => !p.isPublished).length);

// Current Standings (with published programs only)
const currentScores = {};
activeTeams.forEach(t => currentScores[t] = -penaltyMap[t]);
programsWithResults.filter(p => p.isPublished).forEach(p => {
  activeTeams.forEach(t => currentScores[t] += p.teamPts[t]);
});

console.log('\n--- CURRENT LIVE STANDINGS (Published Only) ---');
const sortedCurrent = Object.entries(currentScores).sort((a, b) => b[1] - a[1]);
sortedCurrent.forEach(([t, s], i) => console.log(`${i + 1}. ${t}: ${s} pts`));

// Check unpublished programs breakdown
const unpublished = programsWithResults.filter(p => !p.isPublished);
console.log('\n--- UNPUBLISHED PROGRAMS BREAKDOWN ---');
unpublished.forEach(p => {
  console.log(`[${p.code}] ${p.name} (${p.section}, ${p.category}):`, JSON.stringify(p.teamPts));
});

// Full potential score (if ALL unpublished programs were published)
const allPublishedScores = { ...currentScores };
unpublished.forEach(p => {
  activeTeams.forEach(t => allPublishedScores[t] += p.teamPts[t]);
});
console.log('\n--- POTENTIAL STANDINGS (If ALL unpublished are published) ---');
const sortedAll = Object.entries(allPublishedScores).sort((a, b) => b[1] - a[1]);
sortedAll.forEach(([t, s], i) => console.log(`${i + 1}. ${t}: ${s} pts`));

// Save analysis summary
writeFileSync('analysis_summary.json', JSON.stringify({
  currentScores,
  allPublishedScores,
  activeTeams,
  penaltyMap,
  publishedCount: programsWithResults.filter(p => p.isPublished).length,
  unpublishedPrograms: unpublished
}, null, 2));
