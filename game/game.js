// =====================================================================
//  COŞUYORUZ — TikTok canlı yayın halay oyunu
//  Olaylar (yorum, beğeni, takip, hediye) köprüden (WebSocket) veya test panelinden gelir.
// =====================================================================
(() => {
"use strict";
const C = window.CONFIG;
const W = 1080, H = 1920;
const CX = 540, CY = 790;              // halka merkezi
const RY = C.RING_Y_RATIO;
const cv = document.getElementById("game");
const ctx = cv.getContext("2d");
function fitCanvas() {   // pencereye sığdır (oran korunur)
  const sc = Math.min(window.innerWidth / W, window.innerHeight / H);
  cv.style.width = Math.floor(W * sc) + "px"; cv.style.height = Math.floor(H * sc) + "px";
}
fitCanvas(); window.addEventListener("resize", fitCanvas);
const FONT = '"Segoe UI", "Noto Sans", Arial, sans-serif';

// ---------------------------------------------------------------- yardımcılar
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
function angDiff(a, b) { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; }
function ellipsePerimeter(a, b) { return Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b))); }
function rr(c, x, y, w, h, r) { c.beginPath(); c.roundRect(x, y, w, h, r); }
function shorten(s, n) { s = String(s || ""); return s.length > n ? s.slice(0, n - 1) + "…" : s; }

// ---------------------------------------------------------------- görünüş paletleri
const SKIN = ["#f8dcc0", "#f1c9a3", "#e3b28a", "#cf9a70", "#b07a52"];
const HAIR = ["#2b1a12", "#3b2416", "#151515", "#5a3a22", "#6e4527"];
const DRESS = [
  { main: "#c8102e", trim: "#f2c14e" }, { main: "#6a2c91", trim: "#f2c14e" },
  { main: "#1f8a55", trim: "#f7e7a1" }, { main: "#e0661b", trim: "#fff1c2" },
  { main: "#145f99", trim: "#f2c14e" }, { main: "#b5176b", trim: "#ffd6e8" },
  { main: "#8c1c13", trim: "#e9c46a" }, { main: "#2a9d8f", trim: "#fefae0" },
];
const SCARF = ["#ffffff", "#f4d35e", "#e84a5f", "#9ad1a0", "#f6a5c0", null, null, null];
const MAN = [
  { shirt: "#ffffff", vest: "#1d1d1d", pants: "#1d1d1d", sash: "#c8102e" },
  { shirt: "#f3efe0", vest: "#5b2a12", pants: "#2a2a2a", sash: "#e9c46a" },
  { shirt: "#ffffff", vest: "#7a0f1c", pants: "#1d1d1d", sash: "#f2c14e" },
  { shirt: "#dfe9f3", vest: "#1d3557", pants: "#222222", sash: "#e63946" },
  { shirt: "#ffffff", vest: null,      pants: "#3a3a3a", sash: "#2a9d8f" },
  { shirt: "#e8e2d0", vest: "#264d2a", pants: "#1d1d1d", sash: "#c8102e" },
];
function makeLook(id, gender) {
  const r = rng(hash(id + "|" + gender));
  const look = { gender, skin: pick(r, SKIN), hair: pick(r, HAIR) };
  if (gender === "k") { Object.assign(look, pick(r, DRESS)); look.scarf = pick(r, SCARF); look.longHair = r() < 0.6; }
  else { Object.assign(look, pick(r, MAN)); look.mustache = r() < 0.35; }
  return look;
}

// ---------------------------------------------------------------- oyun durumu
let now = 0;                         // oyun saati (sn)
const dancers = new Map();           // id -> dansçı
const scores = new Map();            // id -> {name, pts}
let rings = [];                      // [[dansçı...], ...] yerleşim
let ringCaps = [];
let rot = new Array(12).fill(0);     // her halkanın dönüş açısı
let leaderId = null;
let cosku = 0;
let beat = 0;
let tempo = 1;
const roles = { gelin: { user: null, until: 0, queue: [] }, damat: { user: null, until: 0, queue: [] } };
let takiCount = { gelin: 0, damat: 0 };
const toasts = [], toastQueue = [];
const flyers = [], sparks = [];
const likeHintAt = new Map();

// ---------------------------------------------------------------- dansçı yönetimi
function ringRx(k) { return C.RING_FIRST_RX + k * C.RING_GAP; }

function getGenderFromText(t) {
  t = " " + t.toLocaleLowerCase("tr") + " ";
  if (/[\s,.!?](kız|kiz|kadın|kadin|bayan|kızım)[\s,.!?]/.test(t)) return "k";
  if (/[\s,.!?](erkek|adam|bay|oğlan|oglan)[\s,.!?]/.test(t)) return "e";
  return null;
}

function ensureDancer(user) {
  let d = dancers.get(user.id);
  if (d && !d.leaving) { if (user.name && user.name !== d.name) { d.name = user.name; d.tag = null; } return d; }
  if (d && d.leaving) { d.leaving = false; d.alpha = Math.max(d.alpha, 0.3); return d; }
  // yer yoksa süresi en az kalan çıkar
  const active = [...dancers.values()].filter(x => !x.leaving && !x.role);
  if (active.length >= C.MAX_DANCERS) {
    let victim = null;
    for (const x of active) if (x.id !== leaderId && (!victim || x.expires < victim.expires)) victim = x;
    if (victim) startLeave(victim);
  }
  const gender = (hash(user.id) & 1) ? "k" : "e";
  d = {
    id: user.id, name: user.name || user.id, gender, look: makeLook(user.id, gender),
    expires: now, joinedAt: now, alpha: 0, leaving: false, leaveAt: 0, fresh: true,
    curA: 0, curR: 0, x: CX, y: CY, s: 1, phase: (hash(user.id) % 100) / 100,
    tag: null, tagKey: "", bubble: null, bubbleUntil: 0, role: null,
  };
  dancers.set(user.id, d);
  if (C.SHOW_JOIN_TOASTS && toastQueue.length < 2) toast(`${shorten(d.name, 18)} halaya katıldı!`, "#ffffff");
  return d;
}
function addTime(d, sec) { d.expires = Math.min(Math.max(d.expires, now) + sec, now + C.MAX_TIME_SEC); }
function startLeave(d) { if (!d.leaving) { d.leaving = true; d.leaveAt = now; } }
function addScore(user, pts) {
  const s = scores.get(user.id) || { name: user.name || user.id, pts: 0 };
  s.pts += pts; if (user.name) s.name = user.name; scores.set(user.id, s);
}

function layout(dt) {
  // aktif dansçılar: halay başı önde, sonra katılış sırası
  const active = [];
  let best = null;
  for (const d of dancers.values()) {
    if (d.leaving || d.role) continue;
    active.push(d);
    const sc = scores.get(d.id);
    if (sc && (!best || sc.pts > best.pts)) best = { id: d.id, pts: sc.pts };
  }
  leaderId = best ? best.id : null;
  active.sort((a, b) => (a.id === leaderId ? -1 : b.id === leaderId ? 1 : a.joinedAt - b.joinedAt));

  // halka kapasiteleri (kalabalıksa aralık daralır)
  let spacing = C.DANCER_SPACING, caps;
  for (let tries = 0; tries < 20; tries++) {
    caps = []; let total = 0;
    for (let k = 0; ringRx(k) <= 505; k++) { const rx = ringRx(k); const c = Math.floor(ellipsePerimeter(rx, rx * RY) / spacing); caps.push(c); total += c; }
    if (total >= active.length || spacing <= 26) break;
    spacing -= 2;
  }
  ringCaps = caps;
  rings = caps.map(() => []);
  let i = 0;
  for (let k = 0; k < caps.length && i < active.length; k++) {
    for (let j = 0; j < caps[k] && i < active.length; j++, i++) {
      const d = active[i]; d.ring = k; d.slot = j; rings[k].push(d);
    }
  }
  for (; i < active.length; i++) startLeave(active[i]); // hiç yer kalmadıysa

  // dönüş
  for (let k = 0; k < caps.length; k++) rot[k] += dt * C.WALK_SPEED * tempo / ringRx(k);

  // her dansçıyı hedefine doğru yürüt
  const ease = Math.min(1, dt * 2.6);
  for (const d of dancers.values()) {
    if (d.role) continue;
    let tA, tR;
    if (d.leaving) { tA = d.curA; tR = ringRx(caps.length - 1) + 320; }
    else {
      const step = (Math.PI * 2) / caps[d.ring];
      tA = rot[d.ring] - d.slot * step;
      tR = ringRx(d.ring);
      if (d.fresh) { d.curA = tA; d.curR = tR + 330; d.fresh = false; }
      d.curA += dt * C.WALK_SPEED * tempo / ringRx(d.ring);
    }
    d.curA += angDiff(d.curA, tA) * ease;
    d.curR += (tR - d.curR) * ease;
    d.x = CX + Math.cos(d.curA) * d.curR;
    d.y = CY + Math.sin(d.curA) * d.curR * RY;
    const maxRy = 505 * RY;
    const depth = clamp((d.y - (CY - maxRy)) / (2 * maxRy), 0, 1);
    d.s = lerp(0.84, 1.1, depth) * C.CHAR_SCALE;
    d.alpha = d.leaving ? Math.max(0, 1 - (now - d.leaveAt) / 1.6) : Math.min(1, d.alpha + dt * 2);
  }
  for (const d of [...dancers.values()]) if (d.leaving && now - d.leaveAt > 1.7) dancers.delete(d.id);
}

// ---------------------------------------------------------------- roller (gelin / damat)
function queueRole(user, gender) {
  const key = gender === "k" ? "gelin" : "damat";
  const R = roles[key];
  if (R.user && R.user.id === user.id) { R.until += C.ROLE_SEC; return; }
  if (R.queue.some(q => q.id === user.id)) return;
  R.queue.push({ id: user.id, name: user.name });
  if (R.user) toast(`${shorten(user.name, 16)} ${key} sırasına girdi (${R.queue.length}. sıra)`, "#ffd166");
}
function updateRoles() {
  for (const key of ["gelin", "damat"]) {
    const R = roles[key];
    if (R.user && now > R.until) {
      const d = dancers.get(R.user.id);
      if (d) { d.role = null; d.fresh = true; d.alpha = 0; }
      R.user = null;
    }
    if (!R.user && R.queue.length) {
      R.user = R.queue.shift(); R.until = now + C.ROLE_SEC;
      const d = dancers.get(R.user.id);
      if (d) { d.role = key; addTime(d, 0); d.expires = Math.max(d.expires, R.until + 30); }
      toast(key === "gelin" ? `${shorten(R.user.name, 16)} artık GELİN!` : `${shorten(R.user.name, 16)} artık DAMAT!`, "#ff7eb6", true);
      burst(key === "gelin" ? CX + 48 : CX - 48, CY - 40, 40);
    }
  }
}

// ---------------------------------------------------------------- takı töreni
function takiName(coins) {
  if (coins < 30) return "çeyrek altın";
  if (coins < 100) return "yarım altın";
  if (coins < 500) return "tam altın";
  if (coins < 5000) return "bilezik";
  return "set takı";
}
function taki(user, coins) {
  const target = Math.random() < 0.5 ? "gelin" : "damat";
  const name = takiName(coins);
  toast(`${shorten(user.name, 16)} ${target === "gelin" ? "geline" : "damada"} ${name} taktı!`, "#ffd700", true);
  const n = coins >= 500 ? 8 : coins >= 100 ? 5 : coins >= 30 ? 3 : 1;
  for (let i = 0; i < n; i++) flyers.push({ x: 620 + (Math.random() - 0.5) * 200, y: 330, t: -i * 0.12, target, big: coins >= 500 });
}
function burst(x, y, n) {
  const cols = ["#ffd700", "#ff4d6d", "#4cc9f0", "#80ed99", "#ffffff", "#f77f00"];
  for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, v = 120 + Math.random() * 260; sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 150, life: 1.2 + Math.random() * 0.6, c: cols[i % cols.length] }); }
}

// ---------------------------------------------------------------- bildirimler
function toast(text, color = "#fff", important = false) {
  const t = { text, color, born: 0, until: 0 };
  if (important) toastQueue.unshift(t); else toastQueue.push(t);
  if (toastQueue.length > 12) toastQueue.length = 12;
}
function updateToasts() {
  for (let i = toasts.length - 1; i >= 0; i--) if (now > toasts[i].until) toasts.splice(i, 1);
  while (toasts.length < 3 && toastQueue.length) { const t = toastQueue.shift(); t.born = now; t.until = now + (toastQueue.length > 3 ? 2.2 : 3.5); toasts.push(t); }
}

// ---------------------------------------------------------------- OLAYLAR (köprü / test paneli)
function normUser(u) { u = u || {}; const id = String(u.id || u.uniqueId || u.name || "anon"); return { id, name: String(u.name || u.nickname || u.uniqueId || id) }; }

function handleEvent(ev) {
  if (!ev || !ev.type) return;
  const user = normUser(ev.user);
  switch (ev.type) {
    case "chat": {
      const text = String(ev.text || "").trim();
      const d = ensureDancer(user);
      addTime(d, 0); d.expires = Math.max(d.expires, Math.min(now + C.CHAT_JOIN_SEC, now + C.MAX_TIME_SEC));
      const g = getGenderFromText(text);
      if (g && g !== d.gender) { d.gender = g; d.look = makeLook(d.id, g); }
      if (text) { d.bubble = shorten(text, 24); d.bubbleUntil = now + 3.5; }
      addScore(user, C.POINTS.chat);
      cosku += C.COSKU_PER_CHAT;
      break;
    }
    case "like": {
      const n = Math.max(1, ev.count | 0);
      addScore(user, C.POINTS.like * n);
      cosku += Math.min(6, n * C.COSKU_PER_LIKE);
      const d = dancers.get(user.id);
      if (d && !d.leaving) addTime(d, C.LIKE_SEC_EACH * n);
      else if ((likeHintAt.get(user.id) || -999) < now - 120 && toastQueue.length < 3) {
        likeHintAt.set(user.id, now); toast(`${shorten(user.name, 16)}, yorum yaz halaya katıl!`, "#a0e7ff");
      }
      break;
    }
    case "follow": {
      addScore(user, C.POINTS.follow);
      const d = dancers.get(user.id); if (d && !d.leaving) addTime(d, C.FOLLOW_BONUS_SEC);
      toast(`${shorten(user.name, 16)} takip etti, hoş geldin!`, "#80ed99", true);
      cosku += 4;
      break;
    }
    case "share": {
      addScore(user, C.POINTS.share);
      const d = dancers.get(user.id); if (d && !d.leaving) addTime(d, C.SHARE_BONUS_SEC);
      toast(`${shorten(user.name, 16)} yayını paylaştı!`, "#80ed99");
      break;
    }
    case "gift": {
      const coins = Math.max(1, (ev.coins | 0) || 1) * Math.max(1, (ev.repeat | 0) || 1);
      const d = ensureDancer(user);
      addTime(d, coins * C.GIFT_SEC_PER_COIN);
      addScore(user, C.POINTS.giftPerCoin * coins);
      cosku += Math.min(40, 4 + coins);
      if (coins >= C.ROLE_MIN_COINS) queueRole(user, d.gender);
      if (coins >= C.TAKI_MIN_COINS) taki(user, coins);
      else toast(`${shorten(user.name, 16)} ${ev.giftName || "hediye"} gönderdi!`, "#ffd166");
      burst(d.x, d.y - 40, 18);
      break;
    }
  }
  cosku = clamp(cosku, 0, 100);
}
window.handleEvent = handleEvent;

// ---------------------------------------------------------------- çizim: karakter
function drawPerson(c, x, y, s, L, st) {
  // st: {bob, step, shimmy, armUp: 0|1 (sağ kol havada), mendil, zurna, davul, hit, bride, groom}
  const bob = st.bob || 0;
  const sx = (st.shimmy || 0);
  c.save();
  c.translate(x, y);
  c.scale(s, s);
  // gölge
  c.fillStyle = "rgba(0,0,0,.18)";
  c.beginPath(); c.ellipse(0, 0, 13, 4, 0, 0, Math.PI * 2); c.fill();

  const lift = st.step ? 4 : 0;
  // bacaklar
  const legC = L.gender === "k" ? (L.bride ? "#ffffff" : "#3a2a20") : L.pants;
  c.fillStyle = legC;
  c.fillRect(-7, -11 - (st.step ? lift : 0), 5, 11 - (st.step ? 0 : 0));
  c.fillRect(2, -11 - (st.step ? 0 : 3), 5, 11);
  c.fillStyle = "#222";
  c.fillRect(-8, -2 - (st.step ? lift : 0), 7, 3); c.fillRect(1, -2 - (st.step ? 0 : 3), 7, 3);

  c.translate(sx, -bob);
  // gövde
  if (L.gender === "k") {
    c.fillStyle = L.main;
    c.beginPath(); c.moveTo(-9, -36); c.lineTo(9, -36); c.lineTo(L.bride ? 18 : 14, -8); c.lineTo(L.bride ? -18 : -14, -8); c.closePath(); c.fill();
    c.fillStyle = L.trim;
    c.fillRect(L.bride ? -18 : -14, -12, L.bride ? 36 : 28, 4);       // etek süsü
    c.fillRect(-9, -27, 18, 3);                                     // kuşak
    if (L.bride) { c.fillStyle = "#d62828"; c.fillRect(-9, -27, 18, 3); }
    if (L.coins) { c.fillStyle = "#ffd700"; for (let i = 0; i < Math.min(L.coins, 14); i++) { c.beginPath(); c.arc(-7 + (i % 5) * 3.5, -33 + Math.floor(i / 5) * 3.2, 1.6, 0, Math.PI * 2); c.fill(); } }
  } else {
    c.fillStyle = L.shirt; rr(c, -9, -36, 18, 26, 4); c.fill();
    if (L.vest) { c.fillStyle = L.vest; c.fillRect(-9, -35, 6, 24); c.fillRect(3, -35, 6, 24); }
    if (L.groom) { c.fillStyle = "#c8102e"; c.beginPath(); c.moveTo(0, -34); c.lineTo(-2.5, -24); c.lineTo(0, -21); c.lineTo(2.5, -24); c.fill(); }
    if (L.sash) { c.fillStyle = L.sash; c.fillRect(-9, -16, 18, 4); }
    if (L.coins) { c.fillStyle = "#ffd700"; for (let i = 0; i < Math.min(L.coins, 14); i++) { c.beginPath(); c.arc(-6 + (i % 4) * 4, -31 + Math.floor(i / 4) * 3.2, 1.6, 0, Math.PI * 2); c.fill(); } }
  }
  const sleeve = L.gender === "k" ? L.main : (L.vest && !L.groom ? L.shirt : L.shirt);
  // kollar
  c.strokeStyle = sleeve; c.lineWidth = 4.5; c.lineCap = "round";
  if (st.armUp) {
    c.beginPath(); c.moveTo(8, -33); c.lineTo(15, -48); c.lineTo(17, -60); c.stroke();
    c.fillStyle = L.skin; c.beginPath(); c.arc(17, -61, 2.6, 0, Math.PI * 2); c.fill();
    if (st.mendil) {
      const a = now * 9;
      c.save(); c.translate(17, -63); c.rotate(a);
      c.fillStyle = "#e63946"; c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(10, -4, 14, 4); c.quadraticCurveTo(6, 6, 0, 0); c.fill();
      c.fillStyle = "#ffd166"; c.fillRect(10, 1, 3, 2);
      c.restore();
    }
  }
  if (st.zurna) {
    c.beginPath(); c.moveTo(-8, -33); c.lineTo(-4, -26); c.lineTo(0, -30); c.moveTo(8, -33); c.lineTo(4, -24); c.lineTo(0, -28); c.stroke();
    c.save(); c.translate(0, -44); c.rotate(st.zurnaTilt || 0);
    c.fillStyle = "#8b5a2b"; c.beginPath(); c.moveTo(-1.5, 0); c.lineTo(1.5, 0); c.lineTo(5, 26); c.lineTo(-5, 26); c.closePath(); c.fill();
    c.fillStyle = "#d4a373"; c.fillRect(-5, 24, 10, 3);
    c.restore();
  }
  if (st.davul) {
    // tokmak kolu
    const h = st.hit || 0;
    c.beginPath(); c.moveTo(8, -33); c.lineTo(17, -30 - h * 10); c.stroke();
    c.strokeStyle = "#5c3d1e"; c.lineWidth = 2.5; c.beginPath(); c.moveTo(17, -30 - h * 10); c.lineTo(10, -40 - h * 14); c.stroke();
    c.strokeStyle = sleeve; c.lineWidth = 4.5;
    c.beginPath(); c.moveTo(-8, -33); c.lineTo(-16, -24); c.stroke();
    // davul
    c.fillStyle = "#b5651d"; rr(c, -15, -31, 30, 17, 3); c.fill();
    c.fillStyle = "#f1e3c6"; c.beginPath(); c.ellipse(-15, -22.5, 3, 8.5, 0, 0, Math.PI * 2); c.fill(); c.beginPath(); c.ellipse(15, -22.5, 3, 8.5, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = "#7f1d1d"; c.lineWidth = 1.2; c.beginPath();
    for (let i = 0; i < 5; i++) { c.moveTo(-12 + i * 6, -30); c.lineTo(-9 + i * 6, -15); } c.stroke();
  }
  // kafa
  const hy = -47;
  if (L.bride) { // duvak
    c.fillStyle = "rgba(255,255,255,.75)";
    c.beginPath(); c.moveTo(-11, hy - 6); c.quadraticCurveTo(-22, hy + 20, -16, hy + 34); c.lineTo(16, hy + 34); c.quadraticCurveTo(22, hy + 20, 11, hy - 6); c.fill();
  }
  if (L.gender === "k" && L.longHair && !L.scarf) { c.fillStyle = L.hair; rr(c, -12, hy - 4, 24, 20, 6); c.fill(); }
  c.fillStyle = L.skin; c.beginPath(); c.arc(0, hy, 11.5, 0, Math.PI * 2); c.fill();
  if (L.gender === "k" && L.scarf) {
    c.fillStyle = L.scarf; c.beginPath(); c.arc(0, hy - 1, 13, Math.PI * 1.02, Math.PI * 1.98); c.lineTo(13, hy + 2); c.quadraticCurveTo(10, hy - 8, 0, hy - 8); c.quadraticCurveTo(-10, hy - 8, -13, hy + 2); c.fill();
    c.fillStyle = "#ffd700"; for (let i = -2; i <= 2; i++) { c.beginPath(); c.arc(i * 4.5, hy - 7.5 + Math.abs(i) * 0.6, 1.3, 0, Math.PI * 2); c.fill(); } // pullar
  } else {
    c.fillStyle = L.hair; c.beginPath(); c.arc(0, hy - 1, 12, Math.PI * 1.05, Math.PI * 1.95); c.quadraticCurveTo(4, hy - 6, -12, hy - 2); c.fill();
  }
  if (L.bride) { c.fillStyle = "#ffd700"; c.beginPath(); c.moveTo(-6, hy - 10); c.lineTo(-4, hy - 15); c.lineTo(-1, hy - 11); c.lineTo(0, hy - 16); c.lineTo(1, hy - 11); c.lineTo(4, hy - 15); c.lineTo(6, hy - 10); c.fill(); }
  // yüz
  c.fillStyle = "#222";
  c.beginPath(); c.arc(-4, hy + 1, 1.5, 0, Math.PI * 2); c.arc(4, hy + 1, 1.5, 0, Math.PI * 2); c.fill();
  c.fillStyle = "rgba(255,120,120,.45)";
  const puff = st.zurna ? 3.2 : 2;
  c.beginPath(); c.arc(-7, hy + 4.5, puff, 0, Math.PI * 2); c.arc(7, hy + 4.5, puff, 0, Math.PI * 2); c.fill();
  if (L.mustache) { c.fillStyle = L.hair; rr(c, -4, hy + 4.2, 8, 2, 1); c.fill(); }
  else if (!st.zurna) { c.strokeStyle = "#7a2e2e"; c.lineWidth = 1.2; c.beginPath(); c.arc(0, hy + 4, 2.6, 0.15 * Math.PI, 0.85 * Math.PI); c.stroke(); }
  c.restore();
}

// ---------------------------------------------------------------- çizim: isim etiketi
function makeTag(d) {
  const isLeader = d.id === leaderId;
  const key = d.name + (isLeader ? "*" : "");
  if (d.tagKey === key && d.tag) return d.tag;
  const t = document.createElement("canvas");
  const g = t.getContext("2d");
  g.font = `bold 15px ${FONT}`;
  const txt = shorten(d.name, 14);
  const w = Math.ceil(g.measureText(txt).width) + 14 + (isLeader ? 16 : 0);
  t.width = w; t.height = 22;
  g.font = `bold 15px ${FONT}`;
  g.fillStyle = isLeader ? "rgba(140,20,20,.85)" : "rgba(20,14,30,.62)";
  rr(g, 0, 0, w, 22, 11); g.fill();
  if (isLeader) { drawCrown(g, 12, 11, 0.55); }
  g.fillStyle = isLeader ? "#ffd166" : "#ffffff";
  g.textBaseline = "middle"; g.fillText(txt, 7 + (isLeader ? 16 : 0), 11.5);
  d.tag = t; d.tagKey = key;
  return t;
}
function drawCrown(g, x, y, s) {
  g.save(); g.translate(x, y); g.scale(s, s);
  g.fillStyle = "#ffd700";
  g.beginPath(); g.moveTo(-11, 7); g.lineTo(-12, -6); g.lineTo(-5, 0); g.lineTo(0, -9); g.lineTo(5, 0); g.lineTo(12, -6); g.lineTo(11, 7); g.closePath(); g.fill();
  g.restore();
}

// ---------------------------------------------------------------- arka plan (bir kez çizilir)
const bg = document.createElement("canvas"); bg.width = W; bg.height = H;
(function drawBackground() {
  const g = bg.getContext("2d");
  const r = rng(42);
  const GB = C.GAME_BOTTOM;
  // gökyüzü
  let gr = g.createLinearGradient(0, 0, 0, 520);
  gr.addColorStop(0, "#6ec6ff"); gr.addColorStop(1, "#d6f0ff");
  g.fillStyle = gr; g.fillRect(0, 0, W, 560);
  // bulutlar
  g.fillStyle = "rgba(255,255,255,.85)";
  for (const [x, y, s] of [[160, 300, 1], [820, 270, 1.2], [520, 350, .8]]) { g.beginPath(); g.arc(x, y, 26 * s, 0, 7); g.arc(x + 30 * s, y - 12 * s, 32 * s, 0, 7); g.arc(x + 64 * s, y, 24 * s, 0, 7); g.fill(); }
  // uzak dağlar
  g.fillStyle = "#9cc5d8";
  g.beginPath(); g.moveTo(0, 470); for (let x = 0; x <= W; x += 60) g.lineTo(x, 400 + Math.sin(x * 0.011) * 40 + Math.sin(x * 0.031) * 18); g.lineTo(W, 560); g.lineTo(0, 560); g.fill();
  // tepeler
  g.fillStyle = "#7cc36a";
  g.beginPath(); g.moveTo(0, 520); for (let x = 0; x <= W; x += 40) g.lineTo(x, 470 + Math.sin(x * 0.008 + 1) * 30); g.lineTo(W, 600); g.lineTo(0, 600); g.fill();
  // çimen
  gr = g.createLinearGradient(0, 480, 0, GB);
  gr.addColorStop(0, "#6fbf55"); gr.addColorStop(1, "#4f9c3d");
  g.fillStyle = gr; g.fillRect(0, 500, W, GB - 500);
  // evler ve ağaçlar (ufukta)
  const house = (x, y, s) => { g.fillStyle = "#f4ead5"; g.fillRect(x, y, 46 * s, 30 * s); g.fillStyle = "#c0392b"; g.beginPath(); g.moveTo(x - 6 * s, y); g.lineTo(x + 23 * s, y - 22 * s); g.lineTo(x + 52 * s, y); g.fill(); g.fillStyle = "#6b4226"; g.fillRect(x + 18 * s, y + 12 * s, 10 * s, 18 * s); };
  house(70, 470, 1.1); house(880, 455, 1.2); house(980, 480, .8); house(250, 488, .7);
  const tree = (x, y, s) => { g.fillStyle = "#6b4226"; g.fillRect(x - 3 * s, y - 10 * s, 6 * s, 12 * s); g.fillStyle = "#2f7d32"; for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(x - (22 - i * 5) * s, y - 8 * s - i * 16 * s); g.lineTo(x, y - 40 * s - i * 16 * s); g.lineTo(x + (22 - i * 5) * s, y - 8 * s - i * 16 * s); g.fill(); } };
  for (let i = 0; i < 16; i++) { const x = r() * W; tree(x, 500 + r() * 30, 0.7 + r() * 0.6); }
  // çiçekler
  for (let i = 0; i < 260; i++) { g.fillStyle = pick(r, ["#ffffff", "#ffe066", "#ff8fab", "#cdb4db"]); g.fillRect(r() * W, 540 + r() * (GB - 560), 3, 3); }
  // dans alanı (çiğnenmiş çimen)
  gr = g.createRadialGradient(CX, CY, 40, CX, CY, 560);
  gr.addColorStop(0, "rgba(214,190,130,.55)"); gr.addColorStop(0.75, "rgba(190,200,120,.25)"); gr.addColorStop(1, "rgba(0,0,0,0)");
  g.save(); g.translate(CX, CY); g.scale(1, RY + 0.06); g.translate(-CX, -CY);
  g.fillStyle = gr; g.beginPath(); g.arc(CX, CY, 560, 0, 7); g.fill(); g.restore();
  // bayrak süsü (düğün)
  const flagLine = (y0, sag, cols) => {
    g.strokeStyle = "#444"; g.lineWidth = 2; g.beginPath();
    for (let x = 0; x <= W; x += 10) { const y = y0 + Math.sin((x / W) * Math.PI) * sag; x === 0 ? g.moveTo(x, y) : g.lineTo(x, y); } g.stroke();
    for (let x = 18, i = 0; x < W; x += 36, i++) { const y = y0 + Math.sin((x / W) * Math.PI) * sag; g.fillStyle = cols[i % cols.length]; g.beginPath(); g.moveTo(x - 12, y); g.lineTo(x + 12, y); g.lineTo(x, y + 24); g.fill(); }
  };
  flagLine(150, 70, ["#e63946", "#ffffff", "#ffd166", "#2a9d8f", "#e63946", "#ffffff"]);
  // alt kısım: TikTok yorumları için karanlık alan
  gr = g.createLinearGradient(0, GB - 80, 0, GB + 60);
  gr.addColorStop(0, "rgba(0,0,0,0)"); gr.addColorStop(1, "#0b0b10");
  g.fillStyle = gr; g.fillRect(0, GB - 80, W, 140);
  g.fillStyle = "#0b0b10"; g.fillRect(0, GB + 60, W, H - GB - 60);
})();

// ---------------------------------------------------------------- HUD
function drawLeaderboard() {
  ctx.textAlign = "left";
  const x = 20, y = 250, w = 360;
  const top = [...scores.entries()].sort((a, b) => b[1].pts - a[1].pts).slice(0, 5);
  const h = 52 + Math.max(1, top.length) * 38;
  ctx.fillStyle = "rgba(25,12,30,.72)"; rr(ctx, x, y, w, h, 16); ctx.fill();
  ctx.font = `800 22px ${FONT}`; ctx.fillStyle = "#ffd166"; ctx.textBaseline = "middle";
  ctx.fillText("Halay Başları", x + 18, y + 27);
  if (!top.length) { ctx.font = `500 17px ${FONT}`; ctx.fillStyle = "#ccc"; ctx.fillText("İlk yorumu sen yaz!", x + 18, y + 70); return; }
  top.forEach(([id, s], i) => {
    const ry = y + 70 + i * 38;
    if (i === 0) drawCrown(ctx, x + 30, ry, 0.9);
    else { ctx.font = `800 19px ${FONT}`; ctx.fillStyle = "#bbb"; ctx.fillText(String(i + 1), x + 24, ry); }
    ctx.font = `700 19px ${FONT}`; ctx.fillStyle = "#fff";
    ctx.fillText(shorten(s.name, 17), x + 54, ry);
    ctx.textAlign = "right"; ctx.fillStyle = "#ffd166"; ctx.fillText(String(Math.round(s.pts)), x + w - 18, ry); ctx.textAlign = "left";
  });
}
function drawGauge() {
  const x = 965, y = 330, r = 68;
  const v = cosku / 100;
  ctx.fillStyle = "rgba(25,12,30,.72)"; ctx.beginPath(); ctx.arc(x, y, r + 14, 0, 7); ctx.fill();
  ctx.lineWidth = 14; ctx.lineCap = "round";
  ctx.strokeStyle = "rgba(255,255,255,.15)"; ctx.beginPath(); ctx.arc(x, y, r, Math.PI * 0.75, Math.PI * 2.25); ctx.stroke();
  const col = v < 0.34 ? "#4cc9f0" : v < 0.67 ? "#ffd166" : "#ff4d6d";
  ctx.strokeStyle = col; ctx.beginPath(); ctx.arc(x, y, r, Math.PI * 0.75, Math.PI * (0.75 + 1.5 * Math.max(0.02, v))); ctx.stroke();
  const label = v < 0.34 ? "Ağır" : v < 0.67 ? "Coşkulu" : "COŞTUK!";
  ctx.textAlign = "center"; ctx.fillStyle = "#fff";
  ctx.font = `800 ${label.length > 5 ? 22 : 26}px ${FONT}`; ctx.fillText(label, x, y - 4);
  ctx.font = `600 15px ${FONT}`; ctx.fillStyle = "#ccc"; ctx.fillText("coşku", x, y + 22);
  // oyuncu sayısı
  let n = 0; for (const d of dancers.values()) if (!d.leaving) n++;
  ctx.fillStyle = "rgba(25,12,30,.72)"; rr(ctx, x - 58, y + 92, 116, 36, 18); ctx.fill();
  ctx.fillStyle = "#fff"; ctx.font = `800 20px ${FONT}`; ctx.fillText(`${n} kişi`, x, y + 111);
  ctx.textAlign = "left";
}
function drawLogo() {
  const x = 625, y = 258;
  ctx.save(); ctx.textAlign = "center"; ctx.textBaseline = "middle";
  const pulse = 1 + Math.max(0, Math.sin(beat * Math.PI * 2)) * 0.03 * (0.5 + cosku / 100);
  ctx.translate(x, y); ctx.scale(pulse, pulse); ctx.rotate(-0.03);
  ctx.font = `900 58px ${FONT}`;
  ctx.lineWidth = 10; ctx.strokeStyle = "#7a0f1c"; ctx.strokeText("COŞUYORUZ", 0, 0);
  const gr = ctx.createLinearGradient(0, -30, 0, 30); gr.addColorStop(0, "#ffe066"); gr.addColorStop(1, "#ff8c42");
  ctx.fillStyle = gr; ctx.fillText("COŞUYORUZ", 0, 0);
  ctx.restore();
}
const HINTS = ["kız / erkek yazınca kıyafet değişir", "Beğeni at, halayda süren uzasın!", "Takip et, düğünümüz büyüsün!", "En çok coşan halay başı olur, mendili sallar!"];
function drawBottomBanner() {
  const y = C.GAME_BOTTOM - 95;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  const hint = HINTS[Math.floor(now / 6) % HINTS.length];
  ctx.font = `700 26px ${FONT}`; ctx.lineWidth = 5; ctx.strokeStyle = "rgba(0,0,0,.6)";
  ctx.strokeText(hint, CX, y); ctx.fillStyle = "#fff"; ctx.fillText(hint, CX, y);
  const by = y + 50, bw = 520, bh = 54;
  ctx.fillStyle = "rgba(20,10,25,.85)"; rr(ctx, CX - bw / 2, by - bh / 2, bw, bh, 27); ctx.fill();
  ctx.strokeStyle = "#ffd166"; ctx.lineWidth = 2; rr(ctx, CX - bw / 2, by - bh / 2, bw, bh, 27); ctx.stroke();
  ctx.font = `800 27px ${FONT}`;
  const a = "Yorum yaz, ", b = "halaya katıl!";
  const wa = ctx.measureText(a).width, wb = ctx.measureText(b).width;
  ctx.textAlign = "left"; ctx.fillStyle = "#fff"; ctx.fillText(a, CX - (wa + wb) / 2, by + 1);
  ctx.fillStyle = "#ffd166"; ctx.fillText(b, CX - (wa + wb) / 2 + wa, by + 1);
}
function drawToasts() {
  ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.font = `800 23px ${FONT}`;
  toasts.forEach((t, i) => {
    const age = now - t.born, left = t.until - now;
    const a = Math.min(1, age * 5, left * 3);
    const y = 330 + i * 46 - (1 - Math.min(1, age * 5)) * 20;
    const w = Math.min(520, ctx.measureText(t.text).width + 36);
    ctx.globalAlpha = a;
    ctx.fillStyle = "rgba(20,10,25,.8)"; rr(ctx, 620 - w / 2, y - 19, w, 38, 19); ctx.fill();
    ctx.fillStyle = t.color; ctx.fillText(t.text, 620, y + 1, 500);
    ctx.globalAlpha = 1;
  });
  ctx.textAlign = "left";
}

// ---------------------------------------------------------------- ana çizim
const BRIDE = { gender: "k", skin: "#f8dcc0", hair: "#3b2416", main: "#ffffff", trim: "#f1e3c6", scarf: null, longHair: true, bride: true, coins: 0 };
const GROOM = { gender: "e", skin: "#f1c9a3", hair: "#151515", shirt: "#ffffff", vest: "#111111", pants: "#111111", sash: null, groom: true, coins: 0 };
const DAVULCU = Object.assign(makeLook("davulcu", "e"), { shirt: "#ffffff", vest: "#7a0f1c", mustache: true });
const ZURNACI = Object.assign(makeLook("zurnaci", "e"), { shirt: "#f3efe0", vest: "#1d3557", mustache: true });

function render() {
  ctx.drawImage(bg, 0, 0);
  const tempoN = clamp((cosku - 20) / 80, 0, 1);
  const bf = beat % 1;
  const shimmyAmt = cosku > 66 ? Math.sin(now * 42) * 1.6 : 0;

  // el ele tutuşma kolları
  ctx.lineCap = "round";
  for (let k = 0; k < rings.length; k++) {
    const R = rings[k]; const full = R.length === ringCaps[k];
    const n = full ? R.length : R.length - 1;
    for (let j = 0; j < n; j++) {
      const a = R[j], b = R[(j + 1) % R.length];
      if (Math.hypot(a.x - b.x, a.y - b.y) > C.DANCER_SPACING * 1.9) continue;
      const al = Math.min(a.alpha, b.alpha); if (al < 0.3) continue;
      const bobA = Math.abs(Math.sin(Math.PI * ((beat + a.phase * 0.15) % 1))) * 5 * a.s;
      const bobB = Math.abs(Math.sin(Math.PI * ((beat + b.phase * 0.15) % 1))) * 5 * b.s;
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2 - 17 * (a.s + b.s) / 2 + Math.sin(beat * Math.PI) * 2;
      ctx.globalAlpha = al;
      ctx.lineWidth = 4.5 * a.s;
      ctx.strokeStyle = a.look.gender === "k" ? a.look.main : a.look.shirt;
      ctx.beginPath(); ctx.moveTo(a.x + (a.x < b.x ? 7 : -7) * a.s, a.y - 32 * a.s - bobA); ctx.lineTo(mx, my); ctx.stroke();
      ctx.strokeStyle = b.look.gender === "k" ? b.look.main : b.look.shirt;
      ctx.beginPath(); ctx.moveTo(b.x + (b.x < a.x ? 7 : -7) * b.s, b.y - 32 * b.s - bobB); ctx.lineTo(mx, my); ctx.stroke();
      ctx.fillStyle = a.look.skin; ctx.beginPath(); ctx.arc(mx, my, 2.6 * a.s, 0, 7); ctx.fill();
    }
  }
  ctx.globalAlpha = 1;

  // derinliğe göre sırala: dansçılar + orta grup
  const items = [];
  for (const d of dancers.values()) if (!d.role && d.alpha > 0.01) items.push(d);
  const centerY = CY + 22;
  BRIDE.coins = takiCount.gelin; GROOM.coins = takiCount.damat;
  items.push({ center: "damat", x: CX - 52, y: centerY, s: 1.85 }, { center: "gelin", x: CX + 52, y: centerY, s: 1.85 },
             { center: "davul", x: CX - 170, y: CY - 8, s: 1.55 }, { center: "zurna", x: CX + 170, y: CY - 8, s: 1.55 });
  items.sort((a, b) => a.y - b.y);

  for (const it of items) {
    if (it.center) {
      const bob = Math.abs(Math.sin(Math.PI * bf)) * 4;
      if (it.center === "gelin") drawPerson(ctx, it.x, it.y, it.s, BRIDE, { bob, step: Math.floor(beat) % 2 });
      else if (it.center === "damat") drawPerson(ctx, it.x, it.y, it.s, GROOM, { bob, step: Math.floor(beat + 1) % 2, armUp: tempoN > 0.5, mendil: false });
      else if (it.center === "davul") drawPerson(ctx, it.x, it.y, it.s, DAVULCU, { bob: bob * 0.5, davul: true, hit: Math.max(0, 1 - bf * 4) });
      else drawPerson(ctx, it.x, it.y, it.s, ZURNACI, { bob: bob * 0.6, zurna: true, zurnaTilt: Math.sin(beat * Math.PI * 0.5) * 0.25 });
      continue;
    }
    const d = it;
    const ph = (beat + d.phase * 0.15) % 1;
    const bob = Math.abs(Math.sin(Math.PI * ph)) * (4 + 4 * tempoN);
    const isLeader = d.id === leaderId && !d.leaving;
    ctx.globalAlpha = d.alpha;
    drawPerson(ctx, d.x, d.y, d.s, d.look, { bob, step: Math.floor(beat + d.phase * 0.15) % 2, shimmy: shimmyAmt, armUp: isLeader || d.leaving, mendil: isLeader });
  }
  ctx.globalAlpha = 1;

  // isim etiketleri ve konuşma balonları
  for (const d of items) {
    if (d.center) continue;
    const tag = makeTag(d);
    const ts = Math.min(1, d.s);
    ctx.globalAlpha = d.alpha;
    ctx.drawImage(tag, d.x - tag.width * ts / 2, d.y - 84 * d.s, tag.width * ts, tag.height * ts);
  }
  ctx.globalAlpha = 1;
  ctx.font = `700 17px ${FONT}`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  for (const d of items) {
    if (d.center || !d.bubble || now > d.bubbleUntil) continue;
    const a = Math.min(1, (d.bubbleUntil - now) * 2);
    const w = ctx.measureText(d.bubble).width + 20, by = d.y - 84 * d.s - 26;
    ctx.globalAlpha = a * d.alpha;
    ctx.fillStyle = "#fffbe6"; rr(ctx, d.x - w / 2, by - 15, w, 30, 12); ctx.fill();
    ctx.beginPath(); ctx.moveTo(d.x - 6, by + 14); ctx.lineTo(d.x + 6, by + 14); ctx.lineTo(d.x, by + 22); ctx.fill();
    ctx.fillStyle = "#222"; ctx.fillText(d.bubble, d.x, by + 1);
  }
  ctx.globalAlpha = 1;

  // gelin ♥ damat etiketi
  {
    const g = roles.gelin.user, dm = roles.damat.user;
    const sec = (R) => R.user ? ` (${Math.ceil(R.until - now)})` : "";
    const txt = (dm ? shorten(dm.name, 12) + sec(roles.damat) : "Damat") + "  ♥  " + (g ? shorten(g.name, 12) + sec(roles.gelin) : "Gelin");
    ctx.font = `800 21px ${FONT}`;
    const w = ctx.measureText(txt).width + 30, y = CY - 138;
    ctx.fillStyle = (g || dm) ? "rgba(160,20,60,.9)" : "rgba(25,12,30,.78)"; rr(ctx, CX - w / 2, y - 17, w, 34, 17); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.fillText(txt, CX, y + 1);
  }

  // takı uçuşları ve konfeti
  for (const f of flyers) {
    if (f.t < 0) continue;
    const tx = f.target === "gelin" ? CX + 52 : CX - 52, ty = CY - 45;
    const p = Math.min(1, f.t / 1.1);
    const x = lerp(f.x, tx, p), y = lerp(f.y, ty, p) - Math.sin(p * Math.PI) * 120;
    ctx.fillStyle = "#ffd700"; ctx.strokeStyle = "#b8860b"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y, f.big ? 14 : 10, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,.8)"; ctx.beginPath(); ctx.arc(x - 3, y - 3, 3, 0, 7); ctx.fill();
  }
  for (const p of sparks) { ctx.globalAlpha = Math.min(1, p.life); ctx.fillStyle = p.c; ctx.fillRect(p.x, p.y, 7, 4); }
  ctx.globalAlpha = 1;

  drawLogo();
  drawLeaderboard();
  drawGauge();
  drawBottomBanner();
  drawToasts();
}

// ---------------------------------------------------------------- müzik
const Music = (() => {
  const list = (window.PLAYLIST || []).filter(t => t && t.file);
  const audio = new Audio(); audio.volume = C.MUSIC_VOLUME; audio.preservesPitch = true;
  let order = [], idx = -1, bpm = C.DEFAULT_BPM, rate = 1;
  const startEl = document.getElementById("start");
  function shuffle() { order = list.map((_, i) => i); for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; } }
  function next() {
    if (!list.length) return;
    idx++; if (idx >= order.length) { shuffle(); idx = 0; }
    let guard = 0; while (bad.has(order[idx]) && guard++ < list.length) { idx++; if (idx >= order.length) idx = 0; }
    const t = list[order[idx]];
    bpm = t.bpm || C.DEFAULT_BPM;
    audio.src = (window.MUSIC_BASE || "") + t.file; audio.playbackRate = rate;
    audio.play().catch(() => { startEl.style.display = "flex"; });
  }
  audio.addEventListener("ended", next);
  const bad = new Set();   // açılamayan dosyalar atlanır
  audio.addEventListener("error", () => { bad.add(order[idx]); if (bad.size < list.length) setTimeout(next, 500); });
  startEl.addEventListener("click", () => { startEl.style.display = "none"; audio.play().catch(() => {}); });
  if (list.length) { shuffle(); next(); }
  return {
    next,
    get bpm() { return bpm; },
    get rate() { return rate; },
    setTempo(t) { const r = 1 + (t - 1) * (C.MUSIC_TEMPO_BOOST / 0.3); if (Math.abs(r - rate) > 0.004) { rate = r; if (list.length) audio.playbackRate = rate; } },
  };
})();

// ---------------------------------------------------------------- köprü bağlantısı (WebSocket)
const bridgeStatus = document.getElementById("bridgeStatus");
if (!window.DEMO) (function connect() {
  let ws;
  try { ws = new WebSocket(C.BRIDGE_URL); } catch (e) { setTimeout(connect, 3000); return; }
  ws.onopen = () => { bridgeStatus.textContent = "bağlı ✓"; bridgeStatus.style.color = "#80ed99"; };
  ws.onmessage = (m) => { try { const data = JSON.parse(m.data); (Array.isArray(data) ? data : [data]).forEach(handleEvent); } catch (e) {} };
  ws.onclose = () => { bridgeStatus.textContent = "bağlı değil"; bridgeStatus.style.color = ""; setTimeout(connect, 3000); };
  ws.onerror = () => {};
})();

// ---------------------------------------------------------------- test paneli
const Sim = (() => {
  const NAMES = ["Ayşe", "Mehmet", "Zeynep", "Ahmet", "Elif", "Mustafa", "Fatma", "Emre", "Merve", "Burak", "Esra", "Hasan", "Büşra", "Can", "Derya", "Serkan", "Gizem", "Murat", "Seda", "Okan", "Hatice", "Yusuf", "Kübra", "Onur", "Melek", "Barış", "Sibel", "Kemal", "Pınar", "Ramazan", "Ebru", "Cem", "Nur", "Tuncay", "Yasemin", "Volkan"];
  const SUFFIX = ["", "", "_35", "06", "_izmir", "61", "63", "23", "_urfa", ".official", "__", "1907", "1905", "_tr", "44", "21", "x", "_k"];
  const MSG = ["Hoppa!", "Oy oy oy!", "Halaya ben de varım", "Coşuyoruz!", "Davulcu abi bas!", "kız", "erkek", "Allah Allah!", "Teyteyy", "Hayırlı olsun", "Selam", "Bende", "Maşallah", "İzmir'den selamlar", "Urfa'dan selam", "Gelin çok güzel", "Zurna coştu", "haydee", "Ha böyle ha böyle", "Bey vey", "Elazığ burada", "Halay başı benim!", "😂😂", "❤️❤️", "selamm", "katıldımm"];
  const pool = [];
  const rand = (a) => a[Math.floor(Math.random() * a.length)];
  function user() {
    if (pool.length > 40 && Math.random() < 0.55) return rand(pool);
    const name = rand(NAMES) + rand(SUFFIX) + (Math.random() < 0.3 ? Math.floor(Math.random() * 99) : "");
    const u = { id: name.toLowerCase(), name }; pool.push(u); return u;
  }
  const el = document.getElementById("sim");
  if (/[?&]sim=1/.test(location.search) || (window.DEMO && innerWidth > 700)) el.style.display = "block";
  const tgl = document.getElementById("simToggle");
  if (tgl) { tgl.style.display = "block"; tgl.onclick = () => { el.style.display = el.style.display === "block" ? "none" : "block"; }; }
  document.addEventListener("keydown", (e) => { if (e.key === "d" || e.key === "D") el.style.display = el.style.display === "block" ? "none" : "block"; });
  el.querySelectorAll("[data-c]").forEach(b => b.onclick = () => { for (let i = 0; i < +b.dataset.c; i++) handleEvent({ type: "chat", user: user(), text: rand(MSG) }); });
  el.querySelectorAll("[data-g]").forEach(b => b.onclick = () => { const [n, c] = b.dataset.g.split(","); handleEvent({ type: "gift", user: user(), giftName: n, coins: +c }); });
  document.getElementById("bKiz").onclick = () => handleEvent({ type: "chat", user: user(), text: "kız" });
  document.getElementById("bErkek").onclick = () => handleEvent({ type: "chat", user: user(), text: "erkek" });
  document.getElementById("bLike").onclick = () => handleEvent({ type: "like", user: user(), count: 20 });
  document.getElementById("bFollow").onclick = () => handleEvent({ type: "follow", user: user() });
  document.getElementById("bClear").onclick = () => { for (const d of dancers.values()) startLeave(d); };
  document.getElementById("bNext").onclick = () => Music.next();
  const rate = document.getElementById("rate"), rateLbl = document.getElementById("rateLbl");
  let perMin = 0, acc = 0;
  rate.oninput = () => { perMin = +rate.value; rateLbl.textContent = perMin; };
  return {
    tick(dt) {
      if (!perMin) return;
      acc += dt * perMin / 60;
      while (acc >= 1) {
        acc--;
        const r = Math.random();
        if (r < 0.8) handleEvent({ type: "chat", user: user(), text: rand(MSG) });
        else if (r < 0.97) handleEvent({ type: "like", user: rand(pool.length ? pool : [user()]), count: 1 + Math.floor(Math.random() * 15) });
        else handleEvent({ type: "follow", user: user() });
      }
    },
    setAuto(n) { perMin = n; rate.value = n; rateLbl.textContent = n; },
  };
})();
window.Sim = Sim;
if (window.DEMO) {   // paylaşılabilir demo: kendi kendine kalabalıklaşsın
  document.getElementById("rate").dispatchEvent(new Event("input"));
  Sim.setAuto(window.DEMO_RATE || 90);
  for (let i = 0; i < 25; i++) document.querySelector('[data-c="1"]').click();
}

// ---------------------------------------------------------------- ana döngü
let last = performance.now(), fpsAcc = 0, fpsN = 0;
const fpsEl = document.getElementById("fps"), cntEl = document.getElementById("cnt");
function step(dt) {
  now += dt;
  Sim.tick(dt);
  // coşku: kalabalık da tabana katkı yapar
  let n = 0; for (const d of dancers.values()) if (!d.leaving) n++;
  cosku = Math.max(Math.min(25, n * 0.25), cosku - C.COSKU_DECAY_PER_SEC * dt);
  tempo = 1 + clamp((cosku - 20) / 80, 0, 1) * 0.3;
  Music.setTempo(tempo);
  beat += dt * (Music.bpm / 60) * Music.rate / 2;   // her 2 vuruşta bir adım
  for (const d of dancers.values()) if (!d.leaving && !d.role && d.expires < now) startLeave(d);
  updateRoles();
  layout(dt);
  updateToasts();
  for (let i = flyers.length - 1; i >= 0; i--) { const f = flyers[i]; f.t += dt; if (f.t > 1.1) { takiCount[f.target]++; burst(f.target === "gelin" ? CX + 52 : CX - 52, CY - 60, 10); flyers.splice(i, 1); } }
  for (let i = sparks.length - 1; i >= 0; i--) { const p = sparks[i]; p.life -= dt; p.vy += 500 * dt; p.x += p.vx * dt; p.y += p.vy * dt; if (p.life <= 0) sparks.splice(i, 1); }
}
function frame(t) {
  const dt = Math.min(0.1, (t - last) / 1000); last = t;
  step(dt);
  render();
  fpsAcc += dt; fpsN++;
  if (fpsAcc > 0.5) { fpsEl.textContent = Math.round(fpsN / fpsAcc); cntEl.textContent = dancers.size; fpsAcc = 0; fpsN = 0; }
  requestAnimationFrame(frame);
}
window.__step = (dt) => { step(dt); render(); };   // test için
requestAnimationFrame(frame);
})();
