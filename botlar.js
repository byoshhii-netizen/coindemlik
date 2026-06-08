// Bot motoru — beceri bazlı, tur sistemiyle uyumlu
const db = require('./database');

class BotMotoru {
  constructor(grafik) {
    this.grafik = grafik;
    this.aktifPozisyonlar = new Map(); // botId -> {miktar, girdigiDeger, yon}
    this.timer = null;
  }

  baslat() { this.adimAt(); }

  adimAt() {
    try {
      const botlar = db.prepare('SELECT * FROM botlar WHERE aktif = 1').all();
      const mevcutDeger = this.grafik.mevcutDegerAl();

      botlar.forEach(bot => {
        if (this.aktifPozisyonlar.has(bot.id)) {
          // Pozisyon kapat
          const poz = this.aktifPozisyonlar.get(bot.id);
          const oran = (mevcutDeger - poz.girdigiDeger) / poz.girdigiDeger;
          let sonuc = poz.yon === 'yukari'
            ? Math.round(poz.miktar * oran)
            : Math.round(poz.miktar * -oran);

          // Bot kötü oynar: yüksek becerili daha az zarar eder ama yine de negatif eğilimli
          const beceriPenalti = 1 - (bot.beceri / 200); // beceri 50 = %75 oranında kalır
          sonuc = Math.round(sonuc * beceriPenalti);

          const yeniJeton = Math.max(100, bot.jeton + sonuc);
          db.prepare('UPDATE botlar SET jeton = ? WHERE id = ?').run(yeniJeton, bot.id);
          this.aktifPozisyonlar.delete(bot.id);
        } else {
          // Yeni pozisyon
          const oynamaEsigi = 25 + bot.beceri * 0.25;
          if (Math.random() * 100 > oynamaEsigi) return;

          const maxMiktar = Math.min(bot.jeton * 0.15, 80 + bot.beceri * 3);
          const miktar = Math.max(150, Math.floor(Math.random() * maxMiktar));
          if (miktar > bot.jeton) return;

          // Düşük becerili botlar çoğunlukla yanlış taraf seçer
          const dogruTarafOlasiligi = 0.4 + (bot.beceri / 500); // max ~0.58
          const yon = Math.random() < dogruTarafOlasiligi ? 'yukari' : 'asagi';

          this.aktifPozisyonlar.set(bot.id, { miktar, girdigiDeger: mevcutDeger, yon });
        }
      });
    } catch(e) {}

    const sure = 6000 + Math.random() * 10000;
    this.timer = setTimeout(() => this.adimAt(), sure);
  }

  // Para Kopar item bot hedefe çarptığında
  botJetonAl(botId, miktar) {
    const bot = db.prepare('SELECT jeton FROM botlar WHERE id = ?').get(botId);
    if (bot && bot.jeton >= miktar) {
      db.prepare('UPDATE botlar SET jeton = jeton - ? WHERE id = ?').run(miktar, botId);
      return true;
    }
    return false;
  }

  durdur() { if (this.timer) clearTimeout(this.timer); }
}

module.exports = BotMotoru;
