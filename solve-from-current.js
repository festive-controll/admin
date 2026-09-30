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

// The 23 programs from original data.txt that user previously clicked:
const original23Codes = [
  'AY17', 'UY24', 'THX10', 'TY11', 'UX2', 'TX19', 'BY2', 'UY2', 'UY5', 'UY12',
  'TY3', 'TY4', 'BY18', 'THX17', 'UX15', 'THX2', 'BY1', 'AX7', 'AX15', 'TX16',
  'TX6', 'THY26', 'THX4'
];

// Let's check what base score is if original 23 were published:
const baseOriginal = { Reyhani: 282, Thugra: 195, Diwani: 338, Thuluth: 368 };
const published23 = allArts.filter(p => original23Codes.includes(p.code));
console.log('Found in original 23 list:', published23.length);

const after23 = { ...baseOriginal };
published23.forEach(p => {
  names.forEach(n => after23[n] += p.pts[n]);
});
console.log('Scores after original 23 programs:', after23);

// Let's check if TY23 was also clicked:
const ty23 = allArts.find(p => p.code === 'TY23');
const after23AndTY23 = { ...after23 };
if (ty23) {
  names.forEach(n => after23AndTY23[n] += ty23.pts[n]);
}
console.log('Scores after 23 + TY23:', after23AndTY23);

// Let's search which combination of published programs equals { 435, 431, 430, 422 }
// Let's search all single or double program additions to original23:
const unpubFrom23 = allArts.filter(p => !original23Codes.includes(p.code));

for (const p of unpubFrom23) {
  const test = { ...after23 };
  names.forEach(n => test[n] += p.pts[n]);
  const sortedVals = Object.values(test).sort((a,b) => b - a);
  if (sortedVals[0] === 435 && (sortedVals[1] === 431 || sortedVals[1] === 430)) {
    console.log('MATCH with single program:', p.code, p.name, test);
  }
}

// Also check 2 programs added
for (let i = 0; i < unpubFrom23.length; i++) {
  for (let j = i + 1; j < unpubFrom23.length; j++) {
    const p1 = unpubFrom23[i];
    const p2 = unpubFrom23[j];
    const test = { ...after23 };
    names.forEach(n => test[n] += p1.pts[n] + p2.pts[n]);
    const sortedVals = Object.values(test).sort((a,b) => b - a);
    if (sortedVals[0] === 435 && sortedVals[1] === 431 && sortedVals[2] === 430 && sortedVals[3] === 422) {
      console.log('EXACT MATCH with 2 programs:', p1.code, p2.code, test);
    }
  }
}
