// Grafik motoru - sunucu tarafında çalışır, tüm oyuncular aynı grafiği görür
const db = require('./database');

class GrafikMotoru {
  constructor(io) {
    this.io = io;
    this.mevcutDeger = 100;
    this.gecmis = [];
    this.maksGecmis = 60;
    this.timer = null;
    this.siradakiManuelDeger = null;
    this.siradakiManuelSure = null;
  }

  baslat() {
    this.adimAt();
  }

  adimAt() {
    const ayarlar = db.prepare('SELECT * FROM grafik_ayarlari WHERE id = 1').get();
    let sure = ayarlar.guncelleme_suresi || 3000;

    // Manuel değer varsa onu kullan
    if (ayarlar.siradaki_deger !== null && ayarlar.siradaki_deger !== undefined) {
      this.mevcutDeger = ayarlar.siradaki_deger;
      if (ayarlar.siradaki_sure) sure = ayarlar.siradaki_sure;
      // Kullandıktan sonra temizle
      db.prepare('UPDATE grafik_ayarlari SET siradaki_deger = NULL, siradaki_sure = NULL WHERE id = 1').run();
    } else {
      // Otomatik hesapla
      const rast = Math.random();
      const artmaOrani = ayarlar.artma_orani || 0.6;
      const maxDegisim = ayarlar.max_degisim || 30;
      const minDeger = ayarlar.min_deger || 10;
      const maxDeger = ayarlar.max_deger || 500;

      let degisim = (Math.random() * maxDegisim);
      if (rast < artmaOrani) {
        this.mevcutDeger += degisim;
      } else {
        this.mevcutDeger -= degisim;
      }

      this.mevcutDeger = Math.max(minDeger, Math.min(maxDeger, this.mevcutDeger));
      this.mevcutDeger = Math.round(this.mevcutDeger * 100) / 100;
    }

    const zaman = Date.now();
    this.gecmis.push({ deger: this.mevcutDeger, zaman });
    if (this.gecmis.length > this.maksGecmis) {
      this.gecmis.shift();
    }

    // Tüm bağlı istemcilere gönder
    this.io.emit('grafik_guncelle', {
      deger: this.mevcutDeger,
      zaman,
      gecmis: this.gecmis
    });

    // Sonraki adım
    const sonrakiAyarlar = db.prepare('SELECT * FROM grafik_ayarlari WHERE id = 1').get();
    const sonrakiSure = sonrakiAyarlar.siradaki_sure || sonrakiAyarlar.guncelleme_suresi || 3000;
    this.timer = setTimeout(() => this.adimAt(), sonrakiSure);
  }

  mevcutDegerAl() {
    return this.mevcutDeger;
  }

  gecmisAl() {
    return this.gecmis;
  }

  durdur() {
    if (this.timer) clearTimeout(this.timer);
  }
}

module.exports = GrafikMotoru;
