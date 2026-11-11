// Kullanım: node render.js <senaryo> <çıktı klasörü>
const { chromium } = require('playwright');
const fs = require('fs');
const [,, scenario, outDir] = process.argv;
const FPS = 30, DUR = 30;
(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 540, height: 960 } });
  p.on('pageerror', e => console.error('PAGEERR', e.message));
  await p.goto('file://' + require('path').resolve(__dirname, '../game/index.html') + '?render=1');
  await p.waitForTimeout(300);
  await p.addScriptTag({ path: require('path').resolve(__dirname, 'scenarios.js') });
  await p.evaluate(({ scenario, FPS }) => {
    const src = document.getElementById('game');
    const out = document.createElement('canvas'); out.width = 1080; out.height = 1920;
    const o = out.getContext('2d');
    const F = '"DejaVu Sans", "Segoe UI", sans-serif';
    let t = 0;
    const [base, ver] = scenario.split(':');
    const S = Object.assign({}, window.SCENARIOS[base], ver ? window.ALT_HOOKS[base] : {});
    const H = window.handleEvent, step = window.__step;
    S.prep(H, window.Sim, step);
    function band(y0, y1) { const g = o.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, '#2a0f2e'); g.addColorStop(1, '#14081a'); o.fillStyle = g; o.fillRect(0, y0, 1080, y1 - y0); }
    function text(s, x, y, size, fill, stroke) {
      o.font = `900 ${size}px ${F}`; o.textAlign = 'center'; o.textBaseline = 'middle';
      while (o.measureText(s).width > 1000 && size > 30) { size -= 2; o.font = `900 ${size}px ${F}`; }
      if (stroke) { o.lineWidth = size / 6; o.strokeStyle = stroke; o.lineJoin = 'round'; o.strokeText(s, x, y); }
      o.fillStyle = fill; o.fillText(s, x, y);
    }
    window.__frame = () => {
      S.tick(t, H, window.Sim);
      step(1 / FPS); t += 1 / FPS;
      band(0, 420); band(1630, 1920);
      o.drawImage(src, 0, 0, 1080, 1210, 0, 420, 1080, 1210);
      const sc = 0.85 + 0.15 * Math.min(1, t * 4) + Math.sin(t * Math.PI * 1.85) * 0.015;
      o.save(); o.translate(540, 300); o.scale(sc, sc); o.translate(-540, -300);
      text(S.hook[0], 540, 250, 56, '#ffffff', '#000');
      text(S.hook[1], 540, 340, 80, '#ffd166', '#7a0f1c');
      o.restore();
      text(S.sub, 540, 1690, 42, '#ffffff', '#000');
      text('Canlı yayında sen de katıl', 540, 1760, 38, '#ffd166', '#000');
      return out.toDataURL('image/jpeg', 0.9);
    };
  }, { scenario, FPS });
  for (let i = 0; i < FPS * DUR; i++) {
    const d = await p.evaluate(() => window.__frame());
    fs.writeFileSync(`${outDir}/${String(i).padStart(4, '0')}.jpg`, Buffer.from(d.split(',')[1], 'base64'));
  }
  await b.close();
})();
