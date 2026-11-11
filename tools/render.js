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
  await p.evaluate(({ scenario, FPS }) => {
    const src = document.getElementById('game');
    const out = document.createElement('canvas'); out.width = 1080; out.height = 1920;
    const o = out.getContext('2d');
    const F = '"DejaVu Sans", "Segoe UI", sans-serif';
    let t = 0;
    const S = {
      doluyor: { hook: ['Yorum yazan', 'HALAYA KATILIYOR!'], sub: 'Halka büyüdükçe coşuyoruz' },
      halaybasi: { hook: ['En çok yorum yazan', 'HALAY BAŞI OLUR!'], sub: 'Mendili sen sallamak ister misin?' },
    }[scenario];
    // senaryo hazırlığı
    const H = window.handleEvent;
    if (scenario === 'doluyor') {
      for (let i = 0; i < 3; i++) H({ type: 'chat', user: { id: 'ilk' + i, name: ['Ayşe', 'Mehmet', 'Elif'][i] }, text: ['Hoppa!', 'Başlıyoruz', 'Ben geldim'][i] });
      for (let i = 0; i < 60; i++) window.__step(1 / 30);
    } else {
      window.Sim.setAuto(240);
      for (let i = 0; i < 30 * 25; i++) window.__step(1 / 30);
      window.Sim.setAuto(120);
    }
    window.__script = (tt) => {
      if (scenario === 'doluyor') {
        window.Sim.setAuto(tt < 6 ? 40 : tt < 14 ? 220 : tt < 22 ? 420 : 560);
      } else {
        // "SEN?" adlı kullanıcı yorumlarla tırmanıp halay başı oluyor
        const k = Math.floor(tt * 10);
        if (tt > 1 && k % 6 === 0 && window.__last !== k) {
          window.__last = k;
          const msgs = ['Ben de varım!', 'Halay başı benim!', 'Davulcu abi bas!', 'Mendil bende!', 'Oy oy oy!', 'Coşuyoruz!'];
          H({ type: 'chat', user: { id: 'sen', name: 'SEN?' }, text: msgs[(k / 6) % msgs.length | 0] });
          if (tt > 6) H({ type: 'like', user: { id: 'sen', name: 'SEN?' }, count: 40 });
        }
      }
    };
    function band(y0, y1) {
      const g = o.createLinearGradient(0, y0, 0, y1);
      g.addColorStop(0, '#2a0f2e'); g.addColorStop(1, '#14081a');
      o.fillStyle = g; o.fillRect(0, y0, 1080, y1 - y0);
    }
    function text(s, x, y, size, fill, stroke) {
      o.font = `900 ${size}px ${F}`; o.textAlign = 'center'; o.textBaseline = 'middle';
      if (stroke) { o.lineWidth = size / 6; o.strokeStyle = stroke; o.lineJoin = 'round'; o.strokeText(s, x, y); }
      o.fillStyle = fill; o.fillText(s, x, y);
    }
    window.__frame = () => {
      window.__script(t);
      window.__step(1 / FPS); t += 1 / FPS;
      band(0, 360); band(1570, 1920);
      o.drawImage(src, 0, 0, 1080, 1210, 0, 360, 1080, 1210);
      const pop = Math.min(1, t * 4); const sc = 0.85 + 0.15 * pop + Math.sin(t * Math.PI * 1.85) * 0.015;
      o.save(); o.translate(540, 0); o.scale(sc, sc); o.translate(-540, 0);
      text(S.hook[0], 540, 175 / sc, 58, '#ffffff', '#000');
      text(S.hook[1], 540, 260 / sc, 82, '#ffd166', '#7a0f1c');
      o.restore();
      text(S.sub, 540, 1625, 44, '#ffffff', '#000');
      text('Canlı yayında sen de katıl', 540, 1700, 40, '#ffd166', '#000');
      return out.toDataURL('image/jpeg', 0.9);
    };
  }, { scenario, FPS });
  for (let i = 0; i < FPS * DUR; i++) {
    const d = await p.evaluate(() => window.__frame());
    fs.writeFileSync(`${outDir}/${String(i).padStart(4, '0')}.jpg`, Buffer.from(d.split(',')[1], 'base64'));
  }
  await b.close();
})();
