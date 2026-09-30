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

  console.log('Navigating to extract.html...');
  await call('Page.navigate', { url: 'http://127.0.0.1:5500/extract.html' });

  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 1000));
    const statusRes = await call('Runtime.evaluate', { expression: 'document.getElementById("status")?.innerText', returnByValue: true });
    const status = statusRes.result?.result?.value;
    console.log(`[${i}s] Status: ${status}`);
    if (status === 'DONE') {
      const dataRes = await call('Runtime.evaluate', { expression: 'window.extractedData', returnByValue: true });
      const data = dataRes.result?.result?.value;
      writeFileSync('live_data.json', JSON.stringify(data, null, 2));
      console.log('Successfully saved live_data.json!');
      break;
    } else if (status && status.startsWith('ERROR:')) {
      console.error(status);
      break;
    }
  }

  ws.close();
}
run().catch(console.error);
