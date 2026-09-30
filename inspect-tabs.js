import { writeFileSync } from 'fs';

async function run() {
  const pages = await fetch('http://127.0.0.1:9223/json').then(r => r.json());
  const page = pages.find(p => p.type === 'page');
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

  // Get Page targets / frame tree
  const frameTree = await call('Page.getFrameTree');
  console.log('Frame tree count:', frameTree.result?.frameTree?.childFrames?.length || 0);
  if (frameTree.result?.frameTree?.childFrames) {
    frameTree.result.frameTree.childFrames.forEach(f => {
      console.log('Child frame url:', f.frame?.url);
    });
  }

  const evalCode = `
    (() => {
      const tables = Array.from(document.querySelectorAll('table')).map(t => t.innerText);
      const mainText = document.body ? document.body.innerText.substring(0, 1500) : '';
      return {
        url: window.location.href,
        tables,
        mainText
      };
    })()
  `;
  const res = await call('Runtime.evaluate', { expression: evalCode, returnByValue: true });
  console.log('Main doc evaluation:', res.result?.result?.value);
  ws.close();
}
run().catch(console.error);
