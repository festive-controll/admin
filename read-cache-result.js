const deadline = Date.now() + 90000;
let pages;
while (Date.now() < deadline) {
  try {
    pages = await fetch('http://127.0.0.1:9223/json').then(r => r.json());
    if (pages.some(p => p.url.includes('cache-calc.html'))) break;
  } catch {}
  await new Promise(r => setTimeout(r, 500));
}
const page = pages?.find(p => p.url.includes('cache-calc.html'));
if (!page) throw new Error('Calculation page was not found.');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
let id = 0;
const pending = new Map();
ws.onmessage = event => { const m = JSON.parse(event.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
function call(method, params = {}) {
  return new Promise(resolve => { const callId = ++id; pending.set(callId, resolve); ws.send(JSON.stringify({ id: callId, method, params })); });
}
await call('Page.navigate', { url: 'http://127.0.0.1:5500/cache-calc.html?run=7' });
let text = '';
while (Date.now() < deadline) {
  const reply = await call('Runtime.evaluate', { expression: "document.getElementById('out')?.textContent || ''", returnByValue: true });
  text = reply.result?.result?.value || '';
  if (text && !text.startsWith('Loading')) break;
  await new Promise(r => setTimeout(r, 1000));
}
ws.close();
console.log(text || 'ERROR: calculation timed out');
