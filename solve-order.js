// Solver: find 30 unpublished programs to set 1-Thugra, 2-Reyhani, 3-Diwani, 4-Thuluth
// Base scores from LIVE screenshot
const base = { Diwani: 613, Thugra: 575, Thuluth: 554, Reyhani: 553 };

// All unpublished programs from node analyze output
const all = [
  { code:'UX15', name:'Story Completion ARB',       section:'Ūlā',        cat:'non-stage', R:1,  T:16, D:0,  Th:0  },
  { code:'TY14', name:'Speech & Song MLM',           section:'Thāniya',    cat:'stage',     R:7,  T:0,  D:5,  Th:0  },
  { code:'TY3',  name:'Science Master',              section:'Thāniya',    cat:'stage',     R:3,  T:12, D:0,  Th:1  },
  { code:'BX19', name:'Typing Master',               section:'Bidāya',     cat:'non-stage', R:14, T:6,  D:0,  Th:0  },
  { code:'TX5',  name:'Essay Writing URD',           section:'Thāniya',    cat:'non-stage', R:6,  T:4,  D:10, Th:0  },
  { code:'BZ10', name:'Sweet Picking',               section:'Bidāya',     cat:'sports',    R:0,  T:0,  D:8,  Th:1  },
  { code:'THY20',name:'GK Talent',                   section:'Thānawiyya', cat:'stage',     R:17, T:7,  D:20, Th:0  },
  { code:'TX17', name:'Cartoon',                     section:'Thāniya',    cat:'non-stage', R:14, T:3,  D:0,  Th:8  },
  { code:'THZ3', name:'Solo War',                    section:'Thānawiyya', cat:'sports',    R:0,  T:0,  D:9,  Th:0  },
  { code:'AZ12', name:'Three-Legged Race',           section:'Āliya',      cat:'sports',    R:0,  T:12, D:10, Th:0  },
  { code:'TY12', name:'Group Song',                  section:'Thāniya',    cat:'stage',     R:12, T:8,  D:15, Th:12 },
  { code:'AY14', name:'Mock Interview ENG',          section:'Āliya',      cat:'stage',     R:10, T:4,  D:6,  Th:3  },
  { code:'THZ4', name:'Penalty',                     section:'Thānawiyya', cat:'sports',    R:10, T:5,  D:7,  Th:0  },
  { code:'THX2', name:'Essay Writing ENG',           section:'Thānawiyya', cat:'non-stage', R:8,  T:6,  D:1,  Th:0  },
  { code:'THX17',name:'Short Story URD',             section:'Thānawiyya', cat:'non-stage', R:6,  T:13, D:3,  Th:8  },
  { code:'BY8',  name:'Group Song',                  section:'Bidāya',     cat:'stage',     R:0,  T:5,  D:13, Th:10 },
  { code:'THY17',name:'Science Master',              section:'Thānawiyya', cat:'stage',     R:10, T:0,  D:12, Th:15 },
  { code:'AY19', name:'Varsity Talent',              section:'Āliya',      cat:'stage',     R:0,  T:3,  D:12, Th:1  },
  { code:'AX7',  name:'Poem Writing URDU',           section:'Āliya',      cat:'non-stage', R:10, T:6,  D:0,  Th:2  },
  { code:'AY23', name:'Digital Tabloid ARB',         section:'Āliya',      cat:'stage',     R:3,  T:8,  D:10, Th:13 },
  { code:'AY9',  name:'Kaviyarang',                  section:'Āliya',      cat:'stage',     R:0,  T:6,  D:0,  Th:11 },
  { code:'TY2',  name:'Math Talent',                 section:'Thāniya',    cat:'stage',     R:8,  T:17, D:8,  Th:22 },
  { code:'UZ9',  name:'Water Filling',               section:'Ūlā',        cat:'sports',    R:0,  T:7,  D:5,  Th:10 },
  { code:'TY4',  name:'Excel Master',                section:'Thāniya',    cat:'stage',     R:3,  T:12, D:10, Th:0  },
  { code:'THY4', name:'Nashīd ARB',                  section:'Thānawiyya', cat:'stage',     R:3,  T:0,  D:16, Th:8  },
  { code:'AY10', name:'Logical Reasoning',           section:'Āliya',      cat:'stage',     R:8,  T:6,  D:0,  Th:4  },
  { code:'BY11', name:'Speech ENG',                  section:'Bidāya',     cat:'stage',     R:0,  T:0,  D:6,  Th:10 },
  { code:'TY16', name:'Speech ENG',                  section:'Thāniya',    cat:'stage',     R:14, T:0,  D:0,  Th:10 },
  { code:'TX19', name:'Instant Newspaper MLM',       section:'Thāniya',    cat:'non-stage', R:3,  T:15, D:8,  Th:12 },
  { code:'BX20', name:'Dictionary Making ARB',       section:'Bidāya',     cat:'non-stage', R:10, T:4,  D:6,  Th:0  },
  { code:'TX16', name:'Image Elaboration ENG',       section:'Thāniya',    cat:'non-stage', R:0,  T:14, D:6,  Th:0  },
  { code:'AY17', name:'Reverse Quiz',                section:'Āliya',      cat:'stage',     R:6,  T:14, D:0,  Th:0  },
  { code:'TY15', name:'Speech MLM',                  section:'Thāniya',    cat:'stage',     R:0,  T:10, D:4,  Th:8  },
  { code:'TX18', name:'Dictionary Making Hindi',     section:'Thāniya',    cat:'non-stage', R:4,  T:0,  D:0,  Th:10 },
  { code:'UY9',  name:'Song URD',                    section:'Ūlā',        cat:'stage',     R:0,  T:6,  D:3,  Th:0  },
  { code:'BX13', name:'Vocabulary',                  section:'Bidāya',     cat:'non-stage', R:0,  T:3,  D:8,  Th:1  },
  { code:'TY1',  name:'GK Quiz',                     section:'Thāniya',    cat:'stage',     R:1,  T:5,  D:0,  Th:3  },
  { code:'UY1',  name:'GK Quiz',                     section:'Ūlā',        cat:'stage',     R:1,  T:3,  D:12, Th:1  },
  { code:'AY1',  name:'Documentary Narration ARB',   section:'Āliya',      cat:'stage',     R:6,  T:0,  D:16, Th:8  },
  { code:'TY21', name:'Grammar Quiz',                section:'Thāniya',    cat:'stage',     R:0,  T:0,  D:8,  Th:7  },
  { code:'UY6',  name:'Song MLM',                    section:'Ūlā',        cat:'stage',     R:10, T:4,  D:0,  Th:8  },
  { code:'THY14',name:'Elocution',                   section:'Thānawiyya', cat:'stage',     R:14, T:0,  D:13, Th:0  },
  { code:'TY7',  name:"Wa'z",                        section:'Thāniya',    cat:'stage',     R:4,  T:0,  D:10, Th:0  },
  { code:'THX4', name:'Essay Writing URD',           section:'Thānawiyya', cat:'non-stage', R:6,  T:10, D:0,  Th:4  },
  { code:'BY2',  name:'Hifz',                        section:'Bidāya',     cat:'stage',     R:6,  T:10, D:0,  Th:0  },
  { code:'AY18', name:"Qur'an Talent",               section:'Āliya',      cat:'stage',     R:0,  T:4,  D:6,  Th:8  },
  { code:'UY2',  name:'PowerPoint Creation',         section:'Ūlā',        cat:'stage',     R:10, T:10, D:0,  Th:0  },
  { code:'THX9', name:'Pros to Poetry ENG',          section:'Thānawiyya', cat:'non-stage', R:8,  T:7,  D:0,  Th:6  },
  { code:'UY5',  name:"Wa'z",                        section:'Ūlā',        cat:'stage',     R:0,  T:11, D:3,  Th:1  },
  { code:'THX8', name:'Pros to Poetry MLM',          section:'Thānawiyya', cat:'non-stage', R:0,  T:1,  D:10, Th:8  },
  { code:'THY24',name:'Documentary Narration ENG',   section:'Thānawiyya', cat:'stage',     R:0,  T:3,  D:0,  Th:11 },
  { code:'UY15', name:'Speech ARB',                  section:'Ūlā',        cat:'stage',     R:0,  T:4,  D:10, Th:8  },
  { code:'THX16',name:'Short Story ARB',             section:'Thānawiyya', cat:'non-stage', R:0,  T:2,  D:6,  Th:14 },
  { code:'UY11', name:'Padhyaparanam',               section:'Ūlā',        cat:'stage',     R:8,  T:4,  D:8,  Th:0  },
  { code:'THY7', name:'Speech ARB',                  section:'Thānawiyya', cat:'stage',     R:14, T:0,  D:6,  Th:4  },
  { code:'THY16',name:'Math Talent',                 section:'Thānawiyya', cat:'stage',     R:11, T:0,  D:15, Th:23 },
  { code:'TY11', name:'Song URD',                    section:'Thāniya',    cat:'stage',     R:10, T:8,  D:6,  Th:0  },
  { code:'BY14', name:'Conversation MLM',            section:'Bidāya',     cat:'stage',     R:0,  T:5,  D:10, Th:13 },
  { code:'THX18',name:'Feature ENG',                 section:'Thānawiyya', cat:'non-stage', R:0,  T:1,  D:6,  Th:10 },
  { code:'AY6',  name:'Lecturing ENG',               section:'Āliya',      cat:'stage',     R:12, T:0,  D:6,  Th:4  },
  { code:'THX27',name:'Digital Typography MLM',      section:'Thānawiyya', cat:'non-stage', R:8,  T:0,  D:3,  Th:14 },
  { code:'THX20',name:"Ta'lim Al-Sunnah MLM",        section:'Thānawiyya', cat:'non-stage', R:4,  T:6,  D:4,  Th:10 },
  { code:'THX14',name:'Short Story MLM',             section:'Thānawiyya', cat:'non-stage', R:3,  T:0,  D:5,  Th:1  },
  { code:'AY11', name:'Junction Speech MLM',         section:'Āliya',      cat:'stage',     R:0,  T:4,  D:6,  Th:8  },
  { code:'BY18', name:'MS Word',                     section:'Bidāya',     cat:'stage',     R:0,  T:3,  D:0,  Th:6  },
  { code:'TY25', name:'Motivational Talk MLM',       section:'Thāniya',    cat:'stage',     R:6,  T:1,  D:0,  Th:8  },
  { code:'KY3',  name:'Debate ENG',                  section:'Kulliya',    cat:'stage',     R:25, T:10, D:20, Th:22 },
  { code:'THY15',name:'Alfiyyah Contest',            section:'Thānawiyya', cat:'stage',     R:3,  T:14, D:5,  Th:13 },
  { code:'THX10',name:'Mr Critic MLM',               section:'Thānawiyya', cat:'non-stage', R:13, T:4,  D:6,  Th:0  },
  { code:'BY13', name:'Kadhakadham',                 section:'Bidāya',     cat:'stage',     R:0,  T:0,  D:14, Th:6  },
  { code:'TZ12', name:'Solo-War',                    section:'Thāniya',    cat:'sports',    R:4,  T:0,  D:0,  Th:5  },
  { code:'THX23',name:'Translation Trilingual',      section:'Thānawiyya', cat:'non-stage', R:6,  T:7,  D:8,  Th:0  },
  { code:'AY15', name:'News Writing & Reading ARB',  section:'Āliya',      cat:'stage',     R:7,  T:9,  D:16, Th:6  },
  { code:'THY8', name:'Speech URD',                  section:'Thānawiyya', cat:'stage',     R:8,  T:5,  D:10, Th:9  },
  { code:'TY23', name:'Debate ENG',                  section:'Thāniya',    cat:'stage',     R:0,  T:10, D:10, Th:0  },
  { code:'THX7', name:'Poem Writing URD',            section:'Thānawiyya', cat:'non-stage', R:3,  T:6,  D:0,  Th:0  },
  { code:'UX14', name:'Story Completion ENG',        section:'Ūlā',        cat:'non-stage', R:0,  T:4,  D:11, Th:9  },
  { code:'AX6',  name:'Poem Writing ARB',            section:'Āliya',      cat:'non-stage', R:0,  T:0,  D:9,  Th:3  },
  { code:'UY12', name:'Speech & Song MLM',           section:'Ūlā',        cat:'stage',     R:10, T:8,  D:13, Th:0  },
  { code:'THY10',name:'Inspiring Talk',              section:'Thānawiyya', cat:'stage',     R:-2, T:8,  D:2,  Th:19 },
  { code:'UX2',  name:'Hindi Vidvan',                section:'Ūlā',        cat:'non-stage', R:6,  T:10, D:0,  Th:1  },
  { code:'AY12', name:'Political Satire MLM',        section:'Āliya',      cat:'stage',     R:10, T:4,  D:11, Th:18 },
  { code:'TX9',  name:'Poem Writing ARB',            section:'Thāniya',    cat:'non-stage', R:1,  T:0,  D:11, Th:0  },
  { code:'BY4',  name:"Wa'z",                        section:'Bidāya',     cat:'stage',     R:6,  T:0,  D:6,  Th:3  },
  { code:'THY19',name:'Tech Tangle',                 section:'Thānawiyya', cat:'stage',     R:4,  T:6,  D:14, Th:0  },
  { code:'AX20', name:'Screenplay Writing',          section:'Āliya',      cat:'non-stage', R:0,  T:6,  D:11, Th:13 },
  { code:'UX1',  name:'Vocabulary',                  section:'Ūlā',        cat:'non-stage', R:1,  T:0,  D:5,  Th:3  },
  { code:'THY13',name:'Parady Song',                 section:'Thānawiyya', cat:'stage',     R:0,  T:8,  D:12, Th:10 },
];

// Score each program: how much does it help reach target Thugra>Reyhani>Diwani>Thuluth
// Score = (T - D) + (R - D) - penalty for Thuluth gain
// Higher = better to INCLUDE
all.forEach(p => {
  p.score = (p.T - p.D) + (p.R - p.D) - 0.3 * p.Th;
});

// Sort by score descending (best programs first)
all.sort((a, b) => b.score - a.score);

// Pick top 30
const selected = all.slice(0, 30);

// Calculate final scores
const final = { ...base };
selected.forEach(p => {
  final.Thugra   += p.T;
  final.Reyhani  += p.R;
  final.Diwani   += p.D;
  final.Thuluth  += p.Th;
});

console.log('=== SELECTED 30 PROGRAMS ===');
selected.forEach((p, i) => {
  console.log(` ${String(i+1).padStart(2)}. [${p.code.padEnd(6)}] ${p.name.padEnd(30)} | Section: ${p.section.padEnd(12)} | Cat: ${p.cat.padEnd(9)} | (+${p.R} Reyhani, +${p.T} Thugra, +${p.D} Diwani, +${p.Th} Thuluth)`);
});

console.log('\n=== FINAL STANDINGS ===');
const sorted = Object.entries(final).sort((a,b) => b[1]-a[1]);
sorted.forEach(([t,s],i) => console.log(`${i+1}. ${t}: ${s} pts`));

const wins = final.Thugra > final.Reyhani && final.Reyhani > final.Diwani && final.Diwani > final.Thuluth;
console.log('\nTarget Achieved (Thugra>Reyhani>Diwani>Thuluth):', wins ? '✅ YES' : '❌ NO');
console.log('Margins:');
console.log(' Thugra-Reyhani:', final.Thugra - final.Reyhani);
console.log(' Reyhani-Diwani:', final.Reyhani - final.Diwani);
console.log(' Diwani-Thuluth:', final.Diwani  - final.Thuluth);
