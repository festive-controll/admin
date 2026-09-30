import { writeFileSync } from 'fs';

async function run() {
  const pages = await fetch('http://127.0.0.1:9223/json').then(r => r.json());
  const page = pages.find(p => p.url.includes('cache-calc.html') || p.url.includes('5500'));
  if (!page) { console.log('No 5500 page'); return; }
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise(res => ws.onopen = res);
  let id = 0;
  const pending = new Map();
  ws.onmessage = e => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) {
      pending.get(m.id)(m);
      pending.delete(m.id);
    }
  };
  function call(method, params = {}) {
    return new Promise(r => {
      const callId = ++id;
      pending.set(callId, r);
      ws.send(JSON.stringify({ id: callId, method, params }));
    });
  }

  const evalCode = `
    (async () => {
      async function getCol(name) {
        try {
          const snap = await db.collection(name).get({ source: 'cache' });
          return snap.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch (e) {
          try {
            const snap = await db.collection(name).get();
            return snap.docs.map(d => ({ id: d.id, ...d.data() }));
          } catch (e2) {
            return [];
          }
        }
      }
      const programs = await getCol('programs');
      const results = await getCol('programResults');
      const teams = await getCol('teams');
      const penalties = await getCol('negativeMarks');
      const candidates = await getCol('candidates');
      return { programs, results, teams, penalties, candidates };
    })()
  `;

  const reply = await call('Runtime.evaluate', { expression: evalCode, awaitPromise: true, returnByValue: true });
  const data = reply.result?.result?.value;
  if (!data) {
    console.error('Failed to get data:', reply);
    ws.close();
    return;
  }
  writeFileSync('data.json', JSON.stringify(data, null, 2));
  console.log('Successfully saved data.json:');
  console.log('Programs:', data.programs.length);
  console.log('Results:', data.results.length);
  console.log('Teams:', data.teams.map(t => t.name));
  console.log('Penalties:', data.penalties.length);
  ws.close();
}
run().catch(console.error);
