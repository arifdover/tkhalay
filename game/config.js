// =====================================================================
//  COŞUYORUZ — Oyun ayarları
//  Bu dosyadaki sayıları değiştirerek oyunun davranışını ayarlayabilirsin.
// =====================================================================
window.CONFIG = {
  // --- Katılım süreleri (saniye) ---
  CHAT_JOIN_SEC: 180,        // Yorum yazan bu kadar süre halayda kalır (her yorum süreyi yeniler)
  LIKE_SEC_EACH: 2,          // Halaydaki biri beğeni atarsa her beğeni +2 sn
  FOLLOW_BONUS_SEC: 120,     // Halaydaki biri takip ederse +2 dk
  SHARE_BONUS_SEC: 60,       // Paylaşım +1 dk
  MAX_TIME_SEC: 1800,        // Bir kişinin birikebilecek en fazla süresi (30 dk)

  // --- Hediyeler (hediye alma açılınca devreye girer) ---
  GIFT_SEC_PER_COIN: 60,     // Her coin değeri için +60 sn (Gül = 1 coin = 1 dk)
  ROLE_MIN_COINS: 99,        // Bu değer ve üstü hediye: gelin/damat olma hakkı
  ROLE_SEC: 90,              // Gelin/damat olarak kalma süresi
  TAKI_MIN_COINS: 5,         // Bu değer ve üstü hediye: takı töreni animasyonu

  // --- Puanlar (sol üstteki "Halay Başları" tablosu) ---
  POINTS: { chat: 5, like: 1, follow: 25, share: 15, giftPerCoin: 20 },

  // --- Halka düzeni ---
  MAX_DANCERS: 260,          // Ekrandaki en fazla oyuncu. Dolunca süresi en az kalan çıkar.
  DANCER_SPACING: 46,        // Halaydaki iki kişi arası mesafe (piksel)
  RING_FIRST_RX: 255,        // İç halkanın yarıçapı
  RING_GAP: 52,              // Halkalar arası mesafe
  RING_Y_RATIO: 0.5,         // Perspektif (halkanın basıklığı)
  WALK_SPEED: 22,            // Halayın dönme hızı (piksel/sn)
  CHAR_SCALE: 1.25,          // Karakter boyutu

  // --- Müzik / tempo ---
  DEFAULT_BPM: 120,          // Şarkının BPM'i playlist'te yoksa bu kullanılır
  MUSIC_VOLUME: 0.8,
  MUSIC_TEMPO_BOOST: 0.06,   // Coşku tavan yapınca müzik en fazla %6 hızlanır (0 = kapalı)

  // --- Coşku göstergesi ---
  COSKU_DECAY_PER_SEC: 1.2,
  COSKU_PER_CHAT: 3,
  COSKU_PER_LIKE: 0.15,

  // --- Bağlantı ---
  BRIDGE_URL: "ws://localhost:8787",   // TikTok köprüsünün adresi

  // --- Ekran ---
  GAME_BOTTOM: 1210,         // Oyun alanının bittiği yer; altı TikTok yorumlarına boş bırakılır
  SHOW_JOIN_TOASTS: true,
};
