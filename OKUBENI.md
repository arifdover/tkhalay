# Coşuyoruz — TikTok Halay Oyunu (prototip)

## Çalıştırma
1. `game/index.html` dosyasına çift tıkla (Chrome/Edge açılır).
2. Klavyede **D** tuşuna bas → test paneli açılır.
3. Panelden sahte yorum, beğeni, takip, hediye gönder; "Otomatik akış" ile canlı yayını taklit et.

## Müzik
1. Suno'dan indirdiğin mp3'leri `game/music/` klasörüne koy.
2. `game/playlist.js` dosyasına ekle:
   `{ file: "music/halay1.mp3", bpm: 120 },`
3. BPM'i bilmek için Suno prompt'una tempo yaz (ör. "120 BPM").
Tarayıcıda ilk açılışta "Müziği başlatmak için tıkla" çıkar (tarayıcı kuralı). OBS'de çıkmaz.

## Ayarlar
Süreler, puanlar, halka boyutu, karakter büyüklüğü: `game/config.js`.

## OBS'ye ekleme (yayın zamanı)
Kaynak ekle → Tarayıcı → "Yerel dosya" işaretle → `game/index.html` → genişlik 1080, yükseklik 1920.
"Sesi OBS üzerinden kontrol et" seçeneğini aç.

## Olay formatı (TikTok köprüsü için)
Köprü `ws://localhost:8787` adresinden şu JSON'ları gönderir:
```
{"type":"chat",   "user":{"id":"kullanici","name":"Görünen Ad"}, "text":"Hoppa!"}
{"type":"like",   "user":{...}, "count":15}
{"type":"follow", "user":{...}}
{"type":"share",  "user":{...}}
{"type":"gift",   "user":{...}, "giftName":"Gül", "coins":1, "repeat":1}
```
