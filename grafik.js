// Grafik + Tur motoru
const db = require('./database');

class GrafikMotoru {
  constructor(io) {
    this.io = io;
    this.mevcutDeger = 200;
    this.gecmis = [];
    this.maksGecmis = 60;
    this.grafTimer = null;
    this.turTimer = null;
    this.momentum = 0;
    // Tur sistemi
    this.turBitis = null;   // ms timestamp
    this.turSuresi = 60;    // saniye (DB'den)
    this.aktifBahisler = new Map(); // socket_id -> bahis bilgisi (sunucu taraflı zorunlu sat)
  }

  baslat() {
    const ayarlar = db.prepare('SELECT * FROM grafik_ayarlari WHERE id = 1').get();
    const min = ayarlar.min_deger || 50;
    const max = ayarlar.max_deger || 500;
    this.mevcutDeger = min + (max - min) * 0.4;
    this.turSuresi = ayarlar.tur_suresi || 60;
    this.grafAdimAt();
    this.yeniTurBaslat();
  }

  // ─── TUR SİSTEMİ ───
  yeniTurBaslat() {
    if (this.turTimer) clearTimeout(this.turTimer);
    const ayarlar = db.prepare('SELECT tur_suresi FROM grafik_ayarlari WHERE id = 1').get();
    this.turSuresi = (ayarlar && ayarlar.tur_suresi) ? ayarlar.tur_suresi : 60;
    this.turBitis = Date.now() + this.turSuresi * 1000;

    this.io.emit('tur_basladi', {
      turBitis: this.turBitis,
      turSuresi: this.turSuresi
    });

    this.turTimer = setTimeout(() => this.turBitti(), this.turSuresi * 1000);
  }

  turBitti() {
    // Aktif tüm bahisleri zorla kapat (sunucu taraflı)
    this.io.emit('tur_bitti');

    // 2 sn sonra yeni tur
    setTimeout(() => this.yeniTurBaslat(), 2000);
  }

  // ─── GRAFİK ADİMLAR ───
  grafAdimAt() {
    const ayarlar = db.prepare('SELECT * FROM grafik_ayarlari WHERE id = 1').get();
    const sure = ayarlar.guncelleme_suresi || 3000;

    if (ayarlar.siradaki_deger !== null && ayarlar.siradaki_deger !== undefined) {
      this.mevcutDeger = parseFloat(ayarlar.siradaki_deger);
      this.momentum = 0;
      db.prepare('UPDATE grafik_ayarlari SET siradaki_deger = NULL, siradaki_sure = NULL WHERE id = 1').run();
    } else {
      const artmaOrani = ayarlar.artma_orani || 0.55;
      const maxDegisim = ayarlar.max_degisim || 40;
      const minDeger = ayarlar.min_deger || 50;
      const maxDeger = ayarlar.max_deger || 500;
      const aralik = maxDeger - minDeger;
      const pozisyon = (this.mevcutDeger - minDeger) / aralik;
      const pozisyonBaskisi = (pozisyon - 0.5) * 0.3;
      const efektifArtma = Math.max(0.2, Math.min(0.8, artmaOrani - pozisyonBaskisi));
      const yonyukari = Math.random() < efektifArtma;
      const degisimOrani = Math.pow(Math.random(), 1.5);
      const degisim = degisimOrani * maxDegisim;
      this.momentum = this.momentum * 0.65 + (yonyukari ? degisim * 0.35 : -degisim * 0.35);
      const toplamDegisim = (yonyukari ? degisim : -degisim) + this.momentum * 0.4;
      this.mevcutDeger += toplamDegisim;
      if (this.mevcutDeger < minDeger) { this.mevcutDeger = minDeger + Math.abs(this.mevcutDeger - minDeger) * 0.3; this.momentum = Math.abs(this.momentum) * 0.5; }
      if (this.mevcutDeger > maxDeger) { this.mevcutDeger = maxDeger - Math.abs(this.mevcutDeger - maxDeger) * 0.3; this.momentum = -Math.abs(this.momentum) * 0.5; }
      this.mevcutDeger = Math.round(this.mevcutDeger * 100) / 100;
    }

    const zaman = Date.now();
    this.gecmis.push({ deger: this.mevcutDeger, zaman });
    if (this.gecmis.length > this.maksGecmis) this.gecmis.shift();

    this.io.emit('grafik_guncelle', {
      deger: this.mevcutDeger,
      zaman,
      gecmis: this.gecmis,
      turBitis: this.turBitis
    });

    const sonraki = db.prepare('SELECT guncelleme_suresi, siradaki_sure FROM grafik_ayarlari WHERE id = 1').get();
    const sonrakiSure = sonraki.siradaki_sure || sonraki.guncelleme_suresi || 3000;
    this.grafTimer = setTimeout(() => this.grafAdimAt(), sonrakiSure);
  }

  mevcutDegerAl() { return this.mevcutDeger; }
  gecmisAl() { return this.gecmis; }
  turBitisAl() { return this.turBitis; }

  durdur() {
    if (this.grafTimer) clearTimeout(this.grafTimer);
    if (this.turTimer) clearTimeout(this.turTimer);
  }
}

module.exports = GrafikMotoru;
