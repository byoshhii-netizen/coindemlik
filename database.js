const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'data', 'demlicoin.db'));

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Tabloları oluştur
db.exec(`
  CREATE TABLE IF NOT EXISTS kullanicilar (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nick TEXT UNIQUE NOT NULL,
    sifre TEXT NOT NULL,
    jeton INTEGER DEFAULT 500,
    toplam_yatirilan REAL DEFAULT 0,
    yasak INTEGER DEFAULT 0,
    chat_yasak INTEGER DEFAULT 0,
    olusturma_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS chat_mesajlari (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kullanici_id INTEGER,
    nick TEXT,
    mesaj TEXT,
    tarih DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(kullanici_id) REFERENCES kullanicilar(id)
  );

  CREATE TABLE IF NOT EXISTS islemler (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kullanici_id INTEGER,
    tip TEXT,
    miktar INTEGER,
    grafik_degeri REAL,
    sonuc INTEGER,
    tarih DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(kullanici_id) REFERENCES kullanicilar(id)
  );

  CREATE TABLE IF NOT EXISTS market_itemlari (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kod TEXT UNIQUE NOT NULL,
    isim TEXT NOT NULL,
    aciklama TEXT,
    fiyat REAL DEFAULT 100,
    para_birimi TEXT DEFAULT 'jeton',
    kullanim_hakki INTEGER DEFAULT 3,
    aktif INTEGER DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS kullanici_itemlari (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kullanici_id INTEGER,
    item_kod TEXT,
    kalan_kullanim INTEGER,
    FOREIGN KEY(kullanici_id) REFERENCES kullanicilar(id)
  );

  CREATE TABLE IF NOT EXISTS jeton_paketleri (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    isim TEXT NOT NULL,
    jeton_miktari INTEGER NOT NULL,
    fiyat REAL NOT NULL,
    para_birimi TEXT DEFAULT 'tl',
    aktif INTEGER DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS grafik_ayarlari (
    id INTEGER PRIMARY KEY DEFAULT 1,
    guncelleme_suresi INTEGER DEFAULT 3000,
    min_deger REAL DEFAULT 10,
    max_deger REAL DEFAULT 500,
    artma_orani REAL DEFAULT 0.6,
    azalma_orani REAL DEFAULT 0.4,
    max_degisim REAL DEFAULT 30,
    siradaki_deger REAL DEFAULT NULL,
    siradaki_sure INTEGER DEFAULT NULL
  );

  CREATE TABLE IF NOT EXISTS para_kopar_ayar (
    id INTEGER PRIMARY KEY DEFAULT 1,
    min_miktar INTEGER DEFAULT 10,
    max_miktar INTEGER DEFAULT 100
  );
`);

// Varsayılan market itemları
const itemSayisi = db.prepare('SELECT COUNT(*) as c FROM market_itemlari').get();
if (itemSayisi.c === 0) {
  db.prepare(`INSERT INTO market_itemlari (kod, isim, aciklama, fiyat, para_birimi, kullanim_hakki) VALUES
    ('iki_kat_kar', '2X Kâr', 'Kazandığın turlardan 2 kat para alırsın. 3 kullanım hakkı.', 200, 'jeton', 3),
    ('zarar_kalkan', 'Zarar Kalkanı', 'Zarar ettiğinde zararın yarısı geri gelir. 3 kullanım hakkı.', 150, 'jeton', 3),
    ('para_kopar', 'Para Kopar', 'Rastgele bir oyuncudan para çal! 1 kullanım hakkı.', 300, 'jeton', 1)
  `).run();
}

// Varsayılan jeton paketleri
const paketSayisi = db.prepare('SELECT COUNT(*) as c FROM jeton_paketleri').get();
if (paketSayisi.c === 0) {
  const paketler = [
    { isim: 'Başlangıç Paketi', jeton: 1500, fiyat: 29.99, para_birimi: 'tl' },
    { isim: 'Bronz Paket', jeton: 5000, fiyat: 79.99, para_birimi: 'tl' },
    { isim: 'Gümüş Paket', jeton: 7500, fiyat: 109.99, para_birimi: 'tl' },
    { isim: 'Altın Paket', jeton: 10000, fiyat: 139.99, para_birimi: 'tl' },
    { isim: 'Elmas Paket', jeton: 15000, fiyat: 199.99, para_birimi: 'tl' },
    { isim: 'Efsane Paket', jeton: 20000, fiyat: 249.99, para_birimi: 'tl' }
  ];
  const stmt = db.prepare('INSERT INTO jeton_paketleri (isim, jeton_miktari, fiyat, para_birimi) VALUES (?, ?, ?, ?)');
  paketler.forEach(p => stmt.run(p.isim, p.jeton, p.fiyat, p.para_birimi));
}

// Varsayılan grafik ayarları
const grafAyar = db.prepare('SELECT COUNT(*) as c FROM grafik_ayarlari').get();
if (grafAyar.c === 0) {
  db.prepare('INSERT INTO grafik_ayarlari (id) VALUES (1)').run();
}

// Varsayılan para kopar ayarı
const koparAyar = db.prepare('SELECT COUNT(*) as c FROM para_kopar_ayar').get();
if (koparAyar.c === 0) {
  db.prepare('INSERT INTO para_kopar_ayar (id) VALUES (1)').run();
}

module.exports = db;
