// Her senaryo: hook (2 satır), sub (alt yazı), prep (başlangıç), tick (her kare)
window.SCENARIOS = (() => {
  const CITIES = ["İzmir'den selam", "Urfa'dan selamlar", "Elazığ burada", "Diyarbakır'dan selam", "Ankara'dan selam", "İstanbul burada", "Malatya'dan selam", "Van'dan selamlar", "Mardin burada", "Antep'ten selam", "Sivas'tan selam", "Erzurum burada", "Almanya'dan selam", "Hollanda'dan selamlar"];
  const say = (H, id, name, text) => H({ type: 'chat', user: { id, name }, text });
  const every = (t, dt, key, fn) => { const k = Math.floor(t / dt); if (window['__' + key] !== k) { window['__' + key] = k; fn(k); } };
  const warm = (S, step, rate, sec) => { S.setAuto(rate); for (let i = 0; i < sec * 30; i++) step(1 / 30); };
  return {
    doluyor: { hook: ['Yorum yazan', 'HALAYA KATILIYOR!'], sub: 'Halka büyüdükçe coşuyoruz',
      prep(H, S, step) { ['Ayşe', 'Mehmet', 'Elif'].forEach((n, i) => say(H, 'i' + i, n, ['Hoppa!', 'Başlıyoruz', 'Ben geldim'][i])); for (let i = 0; i < 60; i++) step(1 / 30); },
      tick(t, H, S) { S.setAuto(t < 6 ? 40 : t < 14 ? 220 : t < 22 ? 420 : 560); } },
    bos: { hook: ['Bu halay', 'BOŞ KALMASIN!'], sub: 'İlk yorumu sen yaz, halaya ilk sen gir',
      prep(H, S, step) { say(H, 'dede', 'Hasan Dede', 'Kimse yok mu?'); for (let i = 0; i < 40; i++) step(1 / 30); },
      tick(t, H, S) { S.setAuto(t < 8 ? 0 : t < 16 ? 90 : 300); every(t, 7, 'bos', k => { if (k === 0) say(H, 'dede', 'Hasan Dede', 'Gelin gençler!'); }); } },
    kizerkek: { hook: ["Yoruma 'kız' ya da 'erkek' yaz", 'KIYAFETİN DEĞİŞSİN!'], sub: 'Elbiseni sen seç, halaya gir',
      prep(H, S, step) { warm(S, step, 200, 12); S.setAuto(60); },
      tick(t, H, S) { every(t, 0.45, 'ke', k => say(H, 'ke' + k, ['Zeynep', 'Kadir', 'Sevgi', 'Ali', 'Nur', 'Cemal', 'Aslı', 'Serkan'][k % 8] + (k + 10), k % 2 ? 'kız' : 'erkek')); } },
    costuk: { hook: ['Beğeni yağınca', 'HALAY COŞUYOR!'], sub: 'Ekrana dokun, davul hızlansın',
      prep(H, S, step) { warm(S, step, 150, 15); S.setAuto(30); },
      tick(t, H, S) { if (t > 5) every(t, 0.25, 'lk', k => H({ type: 'like', user: { id: 'lk' + (k % 40), name: 'İzleyici' + (k % 40) }, count: 25 })); } },
    ikinci: { hook: ['Halka dolunca', 'YENİ HALKA AÇILIYOR!'], sub: 'Kaç halka olacağız? Sen de katıl',
      prep(H, S, step) { warm(S, step, 400, 6); },
      tick(t, H, S) { S.setAuto(t < 20 ? 600 : 300); } },
    sehir: { hook: ['Hangi şehirden izliyorsun?', 'YORUMA YAZ!'], sub: 'Yazan halaya katılıyor',
      prep(H, S, step) { warm(S, step, 150, 10); S.setAuto(40); },
      tick(t, H, S) { every(t, 0.7, 'sh', k => say(H, 'sh' + k, ['Mert', 'Gül', 'Baran', 'Dilan', 'Rıza', 'Hülya', 'Şahin', 'Emine'][k % 8] + '_' + (20 + k), CITIES[k % CITIES.length])); } },
    isim: { hook: ['Adın ekranda', 'HALAY ÇEKSİN!'], sub: 'Tek yapman gereken yorum yazmak',
      prep(H, S, step) { warm(S, step, 80, 8); S.setAuto(120); },
      tick(t, H, S) { every(t, 3, 'is', k => say(H, 'senin' + k, ['SENİN ADIN', 'BURAYA', 'YAZILSIN'][k % 3], 'Ben de buradayım!')); } },
    rekor: { hook: ['Bugün kaç kişi olacağız?', 'REKORU KIRALIM!'], sub: 'Her yorum halkaya bir kişi ekler',
      prep(H, S, step) { warm(S, step, 120, 5); },
      tick(t, H, S) { S.setAuto(120 + t * 25); } },
    halaybasi: { hook: ['En çok yorum yazan', 'HALAY BAŞI OLUR!'], sub: 'Mendili sen sallamak ister misin?',
      prep(H, S, step) { warm(S, step, 240, 25); S.setAuto(120); },
      tick(t, H, S) { if (t > 1) every(t, 0.6, 'hb', k => { say(H, 'sen', 'SEN?', ['Ben de varım!', 'Halay başı benim!', 'Davulcu abi bas!', 'Mendil bende!', 'Oy oy oy!'][k % 5]); if (t > 6) H({ type: 'like', user: { id: 'sen', name: 'SEN?' }, count: 40 }); }); } },
    gelin: { hook: ['Gelinle damat', 'SENİ BEKLİYOR!'], sub: 'Düğün başladı, halaya buyur',
      prep(H, S, step) { warm(S, step, 200, 14); S.setAuto(150); },
      tick(t, H, S) { every(t, 2.5, 'gl', k => say(H, 'gl' + k, ['Teyze', 'Kuzen', 'Sağdıç', 'Komşu', 'Eniştem', 'Yenge'][k % 6] + k, ['Hayırlı olsun!', 'Gelin çok güzel', 'Allah mesut etsin', 'Damat yakışıklı', 'Bir yastıkta kocayın'][k % 5])); } },
  };
})();
// Aynı senaryonun farklı başlıklı ikinci versiyonları ("ad:2")
window.ALT_HOOKS = {
  doluyor: { hook: ['Sen de yaz,', 'HALKA BÜYÜSÜN!'], sub: 'Her yorum halaya bir kişi daha' },
  halaybasi: { hook: ['Mendil kimde?', 'EN ÇOK YAZANDA!'], sub: 'Halay başı olmak için yorum yaz' },
  kizerkek: { hook: ['Elbise mi, yelek mi?', 'YORUMA YAZ, SEÇ!'], sub: "'kız' ya da 'erkek' yazman yeter" },
  costuk: { hook: ['Davulcu abi', 'COŞTU MU NE!'], sub: 'Beğeni geldikçe tempo artıyor' },
  sehir: { hook: ['Memleketini yaz,', 'HALAYDA SELAM VER!'], sub: 'Yorum yazan halaya katılıyor' },
  gelin: { hook: ['Düğünümüze', 'HERKES DAVETLİ!'], sub: 'Yorum yaz, halaya katıl' },
  ikinci: { hook: ['Bu kadar kalabalık', 'HALAY GÖRÜLMEDİ!'], sub: 'Sen de bu halkada ol' },
  rekor: { hook: ['Halkada yer var,', 'HEMEN KATIL!'], sub: 'Yorum yazan anında içeride' },
};
window.SCENARIOS.davul = Object.assign({}, window.SCENARIOS.ikinci, {
  hook: ['Zurna çaldı, davul vurdu', 'SEN NEREDESİN?'], sub: 'Halay başladı, yorum yaz katıl',
  prep(H, S, step) { S.setAuto(300); for (let i = 0; i < 30 * 18; i++) step(1 / 30); },
  tick(t, H, S) { S.setAuto(300); if (t > 3) { const k = Math.floor(t * 4); if (window.__dv !== k) { window.__dv = k; H({ type: 'like', user: { id: 'dv' + (k % 30), name: 'x' + k }, count: 20 }); } } },
});
