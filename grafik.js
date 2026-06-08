// Grafik motoru — smooth, doğal hareket
const db = require('./database');

class GrafikMotoru {
  constructor(io) {
    this.io = io;
    this.mevcutDeger = 200;
    this.gecmis = [];
    this.maksGecmis = 60;
    this.timer = null;
    // Momentum: grafiğin momentum'u (sürekli aynı yöne gitme eğilimi)
    this.momentum = 0;
    this.momentumHalfLife = 3; // kaç adımda momentum yarıya düşer
    this.adimSayisi = 0;
  }

  baslat() {
    // Başlangıç değeri
    const ayarlar = db.prepare('SELECT * FROM grafik_ayarlari WHERE id = 1').get();
    const min = ayarlar.min_deger || 50;
    const max = ayarlar.max_deger || 500;
    this.mevcutDeger = min + (max - min) * 0.4; // başlangıç: alt-orta
    this.adimAt();
  }

  adimAt() {
    const ayarlar = db.prepare('SELECT * FROM grafik_ayarlari WHERE id = 1').get();
    let sure = ayarlar.guncelleme_suresi || 5000;

    // Manuel değer varsa kullan
    if (ayarlar.siradaki_deger !== null && ayarlar.siradaki_deger !== undefined) {
      this.mevcutDeger = parseFloat(ayarlar.siradaki_deger);
      if (ayarlar.siradaki_sure) sure = ayarlar.siradaki_sure;
      this.momentum = 0;
      db.prepare('UPDATE grafik_ayarlari SET siradaki_deger = NULL, siradaki_sure = NULL WHERE id = 1').run();
    } else {
      const artmaOrani = ayarlar.artma_orani || 0.55;
      const maxDegisim = ayarlar.max_degisim || 40;
      const minDeger = ayarlar.min_deger || 50;
      const maxDeger = ayarlar.max_deger || 500;
      const aralik = maxDeger - minDeger;

      // Pozisyon bazlı baskı: çok yüksekteyse düşme eğilimi artar
      const pozisyon = (this.mevcutDeger - minDeger) / aralik; // 0-1
      const pozisyonBaskisi = (pozisyon - 0.5) * 0.3; // -0.15 ile +0.15 arası

      // Efektif artma oranı
      const efektifArtma = Math.max(0.2, Math.min(0.8, artmaOrani - pozisyonBaskisi));

      // Yön belirle
      const yonyukari = Math.random() < efektifArtma;

      // Değişim miktarı: küçük değişimler daha sık, büyük daha nadir
      const degisimOrani = Math.pow(Math.random(), 1.5); // 0-1, küçük sayılar daha olası
      const degisim = degisimOrani * maxDegisim;

      // Momentum uygula
      this.momentum = this.momentum * 0.65 + (yonyukari ? degisim * 0.35 : -degisim * 0.35);

      // Toplam değişim
      const toplamDegisim = (yonyukari ? degisim : -degisim) + this.momentum * 0.4;

      this.mevcutDeger += toplamDegisim;

      // Sınırlar içinde tut (yumuşak sınır)
      if (this.mevcutDeger < minDeger) {
        this.mevcutDeger = minDeger + Math.abs(this.mevcutDeger - minDeger) * 0.3;
        this.momentum = Math.abs(this.momentum) * 0.5;
      }
      if (this.mevcutDeger > maxDeger) {
        this.mevcutDeger = maxDeger - Math.abs(this.mevcutDeger - maxDeger) * 0.3;
        this.momentum = -Math.abs(this.momentum) * 0.5;
      }

      this.mevcutDeger = Math.round(this.mevcutDeger * 100) / 100;
    }

    this.adimSayisi++;
    const zaman = Date.now();
    this.gecmis.push({ deger: this.mevcutDeger, zaman });
    if (this.gecmis.length > this.maksGecmis) this.gecmis.shift();

    this.io.emit('grafik_guncelle', {
      deger: this.mevcutDeger,
      zaman,
      gecmis: this.gecmis
    });

    // Sonraki adım süresi
    const sonraki = db.prepare('SELECT guncelleme_suresi, siradaki_sure FROM grafik_ayarlari WHERE id = 1').get();
    const sonrakiSure = sonraki.siradaki_sure || sonraki.guncelleme_suresi || 5000;
    this.timer = setTimeout(() => this.adimAt(), sonrakiSure);
  }

  mevcutDegerAl() { return this.mevcutDeger; }
  gecmisAl() { return this.gecmis; }
  durdur() { if (this.timer) clearTimeout(this.timer); }
}

module.exports = GrafikMotoru;
