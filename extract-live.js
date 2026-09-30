import { writeFileSync } from 'fs';

async function run() {
  const pages = await fetch('http://127.0.0.1:9223/json').then(r => r.json());
  const page = pages.find(p => p.type === 'page');
  if (!page) { console.log('No page found'); return; }

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise(res => ws.onopen = res);

  let id = 0;
  function call(method, params = {}) {
    return new Promise(r => {
      const callId = ++id;
      const handler = e => {
        const m = JSON.parse(e.data);
        if (m.id === callId) {
          ws.removeEventListener('message', handler);
          r(m);
        }
      };
      ws.addEventListener('message', handler);
      ws.send(JSON.stringify({ id: callId, method, params }));
    });
  }

  const evalCode = `
    (async () => {
      let dbObj = window.db;
      if (!dbObj) {
        const frames = document.querySelectorAll('iframe');
        for (const f of frames) {
          try {
            if (f.contentWindow && f.contentWindow.db) {
              dbObj = f.contentWindow.db;
              break;
            }
          } catch(e) {}
        }
      }
      if (!dbObj && typeof firebase !== 'undefined' && firebase.apps?.length > 0) {
        dbObj = firebase.firestore();
      }
      if (!dbObj) return { error: 'No db instance found' };
      
      const pSnap = await dbObj.collection('programs').get();
      const rSnap = await dbObj.collection('programResults').get();
      const tSnap = await dbObj.collection('teams').get();
      const nSnap = await dbObj.collection('negativeMarks').get();
      
      return {
        programs: pSnap.docs.map(d => ({ id: d.id, ...d.data() })),
        results: rSnap.docs.map(d => ({ id: d.id, ...d.data() })),
        teams: tSnap.docs.map(d => ({ id: d.id, ...d.data() })),
        penalties: nSnap.docs.map(d => ({ id: d.id, ...d.data() }))
      };
    })()
  `;

  const reply = await call('Runtime.evaluate', { expression: evalCode, awaitPromise: true, returnByValue: true });
  console.log('Eval reply status:', reply.result?.result?.value?.error || 'OK');
  
  const data = reply.result?.result?.value;
  if (data && data.programs && data.programs.length > 0) {
    writeFileSync('live_data.json', JSON.stringify(data, null, 2));
    console.log('Successfully updated live_data.json!');
    console.log('Total Programs:', data.programs.length);
    console.log('Published Programs count:', data.programs.filter(p => p.resultsPublished).length);
  }
  ws.close();
}

run().catch(console.error);
