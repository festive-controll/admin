import { writeFileSync } from 'fs';

async function run() {
  const pages = await fetch('http://127.0.0.1:9223/json').then(r => r.json());
  const page = pages.find(p => p.type === 'page');
  if (!page) { console.log('No page found'); return; }
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

  console.log('Navigating to dashboard.html...');
  await call('Page.navigate', { url: 'http://127.0.0.1:5500/dashboard.html' });

  // Wait for db and collections to load
  let data = null;
  for (let i = 0; i < 40; i++) {
    await new Promise(r => setTimeout(r, 1000));
    const checkCode = `
      (async () => {
        try {
          if (typeof db === 'undefined') return { error: 'no db yet' };
          const pSnap = await db.collection('programs').get();
          const rSnap = await db.collection('programResults').get();
          const tSnap = await db.collection('teams').get();
          const nSnap = await db.collection('negativeMarks').get();
          
          return {
            programs: pSnap.docs.map(d => ({ id: d.id, ...d.data() })),
            results: rSnap.docs.map(d => ({ id: d.id, ...d.data() })),
            teams: tSnap.docs.map(d => ({ id: d.id, ...d.data() })),
            penalties: nSnap.docs.map(d => ({ id: d.id, ...d.data() }))
          };
        } catch (e) {
          return { error: e.message };
        }
      })()
    `;
    const res = await call('Runtime.evaluate', { expression: checkCode, awaitPromise: true, returnByValue: true });
    const val = res.result?.result?.value;
    if (val && !val.error && val.programs?.length > 0) {
      data = val;
      break;
    } else {
      console.log('Waiting... status:', val?.error || 'empty');
    }
  }

  if (data) {
    writeFileSync('data.json', JSON.stringify(data, null, 2));
    console.log('Successfully extracted full data.json!');
    console.log('Programs:', data.programs.length);
    console.log('Results:', data.results.length);
    console.log('Teams:', data.teams.map(t => t.name));
    console.log('Penalties:', data.penalties.length);
  } else {
    console.log('Failed to fetch data within timeout.');
  }

  ws.close();
}
run().catch(console.error);
