const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const path = require('path');
const db = require('./database');
const GrafikMotoru = require('./grafik');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const ADMIN_SIFRE = 'kazyontuyozazyontuyozgardas';

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// URL Rewrite: Türkçe karakter içeren URL'leri (ı = %C4%B1) ASCII'ye çevir - ROUTE'LARDAN ÖNCE
app.use((req, res, next) => {
  if (req.url.toLowerCase().includes('%c4%b1')) {
    req.url = req.url.replace(/%[Cc]4%[Bb]1/g, 'i');
  }
  next();
});
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: 'demlicoin-super-gizli-anahtar-2024',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

// Grafik motoru başlat
const grafik = new GrafikMotoru(io);
grafik.baslat();

// (URL decode middleware kaldırıldı - catch-all ile halledildi)

// Auth middleware
function girisGerektir(req, res, next) {
  if (!req.session.kullanici) return res.redirect('/giris');
  const k = db.prepare('SELECT * FROM kullanicilar WHERE id = ?').get(req.session.kullanici.id);
  if (!k || k.yasak) {
    req.session.destroy();
    return res.redirect('/giris?hata=yasakli');
  }
  req.kullanici = k;
  next();
}

function adminGerektir(req, res, next) {
  if (!req.session.admin) return res.redirect('/yonetbunlari/giris');
  next();
}

// ============================================================
// SAYFALAR
// ============================================================

// Ana sayfa - oyun
app.get('/', girisGerektir, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'oyun.html'));
});

// Giriş sayfası
app.get('/giris', (req, res) => {
  if (req.session.kullanici) return res.redirect('/');
  res.sendFile(path.join(__dirname, 'public', 'giris.html'));
});

// Kayıt sayfası
app.get('/kayit', (req, res) => {
  if (req.session.kullanici) return res.redirect('/');
  res.sendFile(path.join(__dirname, 'public', 'kayit.html'));
});

// Market sayfası
app.get('/market', girisGerektir, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'market.html'));
});

// Liderlik tablosu
app.get('/liderlik', girisGerektir, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'liderlik.html'));
});

// Admin giriş sayfası
app.get('/yonetbunlari/giris', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin-giris.html'));
});

// Admin panel
app.get('/yonetbunlari', adminGerektir, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// ============================================================
// AUTH API
// ============================================================

app.post('/api/giris', (req, res) => {
  const { nick, sifre } = req.body;
  if (!nick || !sifre) return res.json({ basari: false, mesaj: 'Nick ve şifre gerekli.' });

  const k = db.prepare('SELECT * FROM kullanicilar WHERE nick = ?').get(nick);
  if (!k) return res.json({ basari: false, mesaj: 'Nick veya şifre hatalı.' });
  if (k.yasak) return res.json({ basari: false, mesaj: 'Hesabınız yasaklanmıştır.' });

  const eslesti = bcrypt.compareSync(sifre, k.sifre);
  if (!eslesti) return res.json({ basari: false, mesaj: 'Nick veya şifre hatalı.' });

  req.session.kullanici = { id: k.id, nick: k.nick };
  res.json({ basari: true });
});

app.post('/api/kayit', (req, res) => {
  const { nick, sifre } = req.body;
  if (!nick || !sifre) return res.json({ basari: false, mesaj: 'Nick ve şifre gerekli.' });
  if (nick.length < 3 || nick.length > 20) return res.json({ basari: false, mesaj: 'Nick 3-20 karakter olmalı.' });
  if (sifre.length < 4) return res.json({ basari: false, mesaj: 'Şifre en az 4 karakter olmalı.' });

  const mevcut = db.prepare('SELECT id FROM kullanicilar WHERE nick = ?').get(nick);
  if (mevcut) return res.json({ basari: false, mesaj: 'Bu nick zaten alınmış.' });

  const hash = bcrypt.hashSync(sifre, 10);
  const sonuc = db.prepare('INSERT INTO kullanicilar (nick, sifre) VALUES (?, ?)').run(nick, hash);
  req.session.kullanici = { id: sonuc.lastInsertRowid, nick };
  res.json({ basari: true });
});

app.post('/api/cikis', (req, res) => {
  req.session.destroy();
  res.json({ basari: true });
});

// ============================================================
// OYUN API
// ============================================================

app.get('/api/benim-bilgilerim', girisGerektir, (req, res) => {
  const k = db.prepare('SELECT id, nick, jeton, toplam_yatirilan FROM kullanicilar WHERE id = ?').get(req.kullanici.id);
  const itemler = db.prepare('SELECT * FROM kullanici_itemlari WHERE kullanici_id = ?').all(k.id);
  res.json({ basari: true, kullanici: k, itemler });
});

app.get('/api/grafik-durumu', (req, res) => {
  res.json({
    mevcutDeger: grafik.mevcutDegerAl(),
    gecmis: grafik.gecmisAl()
  });
});

app.get('/api/cevrimici-oyuncular', (req, res) => {
  const oyuncular = [];
  const sockets = io.sockets.sockets;
  sockets.forEach(socket => {
    if (socket.kullanici) {
      oyuncular.push({ id: socket.kullanici.id, nick: socket.kullanici.nick, jeton: socket.kullanici.jeton });
    }
  });
  // Tekrar eden id'leri temizle
  const benzersiz = [...new Map(oyuncular.map(o => [o.id, o])).values()];
  res.json({ oyuncular: benzersiz });
});

app.post('/api/bahis', girisGerektir, (req, res) => {
  const { jeton_miktari, yon } = req.body; // yon: 'yukari' veya 'asagi'
  const miktar = parseInt(jeton_miktari);

  if (!miktar || miktar < 1) return res.json({ basari: false, mesaj: 'Geçersiz miktar.' });
  if (!['yukari', 'asagi'].includes(yon)) return res.json({ basari: false, mesaj: 'Geçersiz yön.' });

  const k = db.prepare('SELECT * FROM kullanicilar WHERE id = ?').get(req.kullanici.id);
  if (k.jeton < miktar) return res.json({ basari: false, mesaj: 'Yetersiz jeton.' });

  const bahisGirdigiDeger = grafik.mevcutDegerAl();

  // Jetonu düş
  db.prepare('UPDATE kullanicilar SET jeton = jeton - ? WHERE id = ?').run(miktar, k.id);

  // Bahisi kaydet (aktif bahis olarak)
  db.prepare(`INSERT INTO islemler (kullanici_id, tip, miktar, grafik_degeri, sonuc) 
    VALUES (?, 'aktif_bahis_' || ?, ?, ?, NULL)`).run(k.id, yon, miktar, bahisGirdigiDeger);

  const bahisId = db.prepare('SELECT last_insert_rowid() as id').get().id;

  res.json({ basari: true, bahisId, girdigiDeger: bahisGirdigiDeger });
});

app.post('/api/sat', girisGerektir, (req, res) => {
  const { bahis_id } = req.body;

  const bahis = db.prepare('SELECT * FROM islemler WHERE id = ? AND kullanici_id = ? AND sonuc IS NULL').get(bahis_id, req.kullanici.id);
  if (!bahis) return res.json({ basari: false, mesaj: 'Bahis bulunamadı.' });

  const mevcutDeger = grafik.mevcutDegerAl();
  const girisDegeri = bahis.grafik_degeri;
  const miktar = bahis.miktar;
  const yon = bahis.tip.replace('aktif_bahis_', '');

  // Kâr/zarar hesapla
  let oran;
  if (yon === 'yukari') {
    oran = (mevcutDeger - girisDegeri) / girisDegeri;
  } else {
    oran = (girisDegeri - mevcutDeger) / girisDegeri;
  }

  let kazan = Math.round(miktar * oran);
  let orijinalKazan = kazan;

  // Item kontrolü - 2X Kâr
  if (kazan > 0) {
    const ikiKat = db.prepare(`SELECT * FROM kullanici_itemlari WHERE kullanici_id = ? AND item_kod = 'iki_kat_kar' AND kalan_kullanim > 0`).get(req.kullanici.id);
    if (ikiKat) {
      kazan = kazan * 2;
      db.prepare('UPDATE kullanici_itemlari SET kalan_kullanim = kalan_kullanim - 1 WHERE id = ?').run(ikiKat.id);
      if (ikiKat.kalan_kullanim - 1 <= 0) {
        db.prepare('DELETE FROM kullanici_itemlari WHERE id = ?').run(ikiKat.id);
      }
    }
  }

  // Item kontrolü - Zarar Kalkanı
  if (kazan < 0) {
    const kalkan = db.prepare(`SELECT * FROM kullanici_itemlari WHERE kullanici_id = ? AND item_kod = 'zarar_kalkan' AND kalan_kullanim > 0`).get(req.kullanici.id);
    if (kalkan) {
      kazan = Math.round(kazan / 2); // Zararın yarısı
      db.prepare('UPDATE kullanici_itemlari SET kalan_kullanim = kalan_kullanim - 1 WHERE id = ?').run(kalkan.id);
      if (kalkan.kalan_kullanim - 1 <= 0) {
        db.prepare('DELETE FROM kullanici_itemlari WHERE id = ?').run(kalkan.id);
      }
    }
  }

  // Jeton güncelle: başta çektiğimiz miktarı geri ver + kazanç/kayıp
  const jetonDegisim = miktar + kazan;
  db.prepare('UPDATE kullanicilar SET jeton = jeton + ? WHERE id = ?').run(Math.max(0, jetonDegisim), req.kullanici.id);

  // Bahisi kapat
  db.prepare('UPDATE islemler SET sonuc = ?, grafik_degeri = ? WHERE id = ?').run(kazan, mevcutDeger, bahis.id);

  const yeniJeton = db.prepare('SELECT jeton FROM kullanicilar WHERE id = ?').get(req.kullanici.id).jeton;

  // Güncellemeyi yayınla
  io.emit('jeton_guncelle', { kullanici_id: req.kullanici.id, jeton: yeniJeton });

  res.json({
    basari: true,
    kazanc: kazan,
    yeniJeton,
    girdigiDeger: girisDegeri,
    ciktifiDeger: mevcutDeger
  });
});

// Para Kopar item kullan
app.post('/api/para-kopar', girisGerektir, (req, res) => {
  const koparItem = db.prepare(`SELECT * FROM kullanici_itemlari WHERE kullanici_id = ? AND item_kod = 'para_kopar' AND kalan_kullanim > 0`).get(req.kullanici.id);
  if (!koparItem) return res.json({ basari: false, mesaj: 'Para Kopar iteminiz yok.' });

  const ayar = db.prepare('SELECT * FROM para_kopar_ayar WHERE id = 1').get();
  const min = ayar.min_miktar || 10;
  const max = ayar.max_miktar || 100;

  // Rastgele oyuncu seç (kendisi hariç, jetonu olan)
  const oyuncular = [];
  const sockets = io.sockets.sockets;
  sockets.forEach(socket => {
    if (socket.kullanici && socket.kullanici.id !== req.kullanici.id) {
      oyuncular.push(socket.kullanici);
    }
  });

  if (oyuncular.length === 0) return res.json({ basari: false, mesaj: 'Çalacak başka oyuncu yok.' });

  const hedef = oyuncular[Math.floor(Math.random() * oyuncular.length)];
  const hedefBilgi = db.prepare('SELECT * FROM kullanicilar WHERE id = ?').get(hedef.id);
  if (!hedefBilgi || hedefBilgi.jeton < min) return res.json({ basari: false, mesaj: 'Hedef oyuncunun yeterli jetonu yok.' });

  const miktar = Math.min(hedefBilgi.jeton, Math.floor(Math.random() * (max - min + 1)) + min);

  db.prepare('UPDATE kullanicilar SET jeton = jeton - ? WHERE id = ?').run(miktar, hedef.id);
  db.prepare('UPDATE kullanicilar SET jeton = jeton + ? WHERE id = ?').run(miktar, req.kullanici.id);

  // İtemi kullan
  db.prepare('UPDATE kullanici_itemlari SET kalan_kullanim = kalan_kullanim - 1 WHERE id = ?').run(koparItem.id);
  if (koparItem.kalan_kullanim - 1 <= 0) {
    db.prepare('DELETE FROM kullanici_itemlari WHERE id = ?').run(koparItem.id);
  }

  const yeniJeton = db.prepare('SELECT jeton FROM kullanicilar WHERE id = ?').get(req.kullanici.id).jeton;
  const hedefYeniJeton = db.prepare('SELECT jeton FROM kullanicilar WHERE id = ?').get(hedef.id).jeton;

  io.emit('jeton_guncelle', { kullanici_id: req.kullanici.id, jeton: yeniJeton });
  io.emit('jeton_guncelle', { kullanici_id: hedef.id, jeton: hedefYeniJeton });

  res.json({ basari: true, calinanMiktar: miktar, hedefNick: hedefBilgi.nick, yeniJeton });
});

// ============================================================
// MARKET API
// ============================================================

app.get('/api/market/itemlar', girisGerektir, (req, res) => {
  const itemlar = db.prepare('SELECT * FROM market_itemlari WHERE aktif = 1').all();
  res.json({ basari: true, itemlar });
});

app.get('/api/market/jeton-paketleri', girisGerektir, (req, res) => {
  const paketler = db.prepare('SELECT * FROM jeton_paketleri WHERE aktif = 1').all();
  res.json({ basari: true, paketler });
});

app.post('/api/market/satin-al', girisGerektir, (req, res) => {
  const { item_id } = req.body;
  const item = db.prepare('SELECT * FROM market_itemlari WHERE id = ? AND aktif = 1').get(item_id);
  if (!item) return res.json({ basari: false, mesaj: 'Item bulunamadı.' });

  const k = db.prepare('SELECT * FROM kullanicilar WHERE id = ?').get(req.kullanici.id);

  if (item.para_birimi === 'jeton') {
    if (k.jeton < item.fiyat) return res.json({ basari: false, mesaj: 'Yetersiz jeton.' });
    db.prepare('UPDATE kullanicilar SET jeton = jeton - ? WHERE id = ?').run(item.fiyat, k.id);
  } else {
    // TL veya Dolar satışı - gerçek ödeme entegrasyonu olmadığından simüle ediyoruz
    return res.json({ basari: false, mesaj: 'Bu item için gerçek ödeme gerekli. Şu an demo modda.' });
  }

  // Zaten var mı?
  const mevcutItem = db.prepare('SELECT * FROM kullanici_itemlari WHERE kullanici_id = ? AND item_kod = ?').get(k.id, item.kod);
  if (mevcutItem) {
    db.prepare('UPDATE kullanici_itemlari SET kalan_kullanim = kalan_kullanim + ? WHERE id = ?').run(item.kullanim_hakki, mevcutItem.id);
  } else {
    db.prepare('INSERT INTO kullanici_itemlari (kullanici_id, item_kod, kalan_kullanim) VALUES (?, ?, ?)').run(k.id, item.kod, item.kullanim_hakki);
  }

  const yeniJeton = db.prepare('SELECT jeton FROM kullanicilar WHERE id = ?').get(k.id).jeton;
  res.json({ basari: true, mesaj: `${item.isim} satın alındı!`, yeniJeton });
});

app.post('/api/market/jeton-satin-al', girisGerektir, (req, res) => {
  const { paket_id } = req.body;
  const paket = db.prepare('SELECT * FROM jeton_paketleri WHERE id = ? AND aktif = 1').get(paket_id);
  if (!paket) return res.json({ basari: false, mesaj: 'Paket bulunamadı.' });

  // Demo: Direkt jeton ver
  db.prepare('UPDATE kullanicilar SET jeton = jeton + ?, toplam_yatirilan = toplam_yatirilan + ? WHERE id = ?')
    .run(paket.jeton_miktari, paket.fiyat, req.kullanici.id);

  const yeniJeton = db.prepare('SELECT jeton FROM kullanicilar WHERE id = ?').get(req.kullanici.id).jeton;
  res.json({ basari: true, mesaj: `${paket.jeton_miktari} jeton hesabınıza eklendi!`, yeniJeton });
});

// ============================================================
// LİDERLİK API
// ============================================================

app.get('/api/liderlik', (req, res) => {
  const liste = db.prepare('SELECT nick, jeton, toplam_yatirilan FROM kullanicilar WHERE yasak = 0 ORDER BY jeton DESC LIMIT 50').all();
  res.json({ basari: true, liste });
});

// ============================================================
// CHAT API
// ============================================================

app.get('/api/chat/gecmis', girisGerektir, (req, res) => {
  const mesajlar = db.prepare('SELECT nick, mesaj, tarih FROM chat_mesajlari ORDER BY id DESC LIMIT 50').all();
  res.json({ basari: true, mesajlar: mesajlar.reverse() });
});

// ============================================================
// ADMİN API
// ============================================================

app.post('/api/admin/giris', (req, res) => {
  const { sifre } = req.body;
  if (sifre === ADMIN_SIFRE) {
    req.session.admin = true;
    res.json({ basari: true });
  } else {
    res.json({ basari: false, mesaj: 'Şifre hatalı.' });
  }
});

app.post('/api/admin/cikis', (req, res) => {
  req.session.admin = false;
  res.json({ basari: true });
});

// Grafik ayarları güncelle
app.post('/api/admin/grafik-ayar', adminGerektir, (req, res) => {
  const { guncelleme_suresi, min_deger, max_deger, artma_orani, azalma_orani, max_degisim, siradaki_deger, siradaki_sure } = req.body;
  db.prepare(`UPDATE grafik_ayarlari SET 
    guncelleme_suresi = ?, min_deger = ?, max_deger = ?,
    artma_orani = ?, azalma_orani = ?, max_degisim = ?,
    siradaki_deger = ?, siradaki_sure = ?
    WHERE id = 1`).run(
    guncelleme_suresi || 3000, min_deger || 10, max_deger || 500,
    artma_orani || 0.6, azalma_orani || 0.4, max_degisim || 30,
    siradaki_deger || null, siradaki_sure || null
  );
  res.json({ basari: true, mesaj: 'Grafik ayarları güncellendi.' });
});

// Oyuncuları listele
app.get('/api/admin/oyuncular', adminGerektir, (req, res) => {
  const oyuncular = db.prepare('SELECT id, nick, jeton, toplam_yatirilan, yasak, chat_yasak, olusturma_tarihi FROM kullanicilar ORDER BY jeton DESC').all();
  res.json({ basari: true, oyuncular });
});

// Oyuncu yasakla/aç
app.post('/api/admin/oyuncu-yasak', adminGerektir, (req, res) => {
  const { kullanici_id, durum } = req.body;
  db.prepare('UPDATE kullanicilar SET yasak = ? WHERE id = ?').run(durum ? 1 : 0, kullanici_id);
  if (durum) {
    // Bağlı soketi at
    io.sockets.sockets.forEach(socket => {
      if (socket.kullanici && socket.kullanici.id === parseInt(kullanici_id)) {
        socket.emit('yasaklandi');
        socket.disconnect();
      }
    });
  }
  res.json({ basari: true });
});

// Chat yasağı
app.post('/api/admin/chat-yasak', adminGerektir, (req, res) => {
  const { kullanici_id, durum } = req.body;
  db.prepare('UPDATE kullanicilar SET chat_yasak = ? WHERE id = ?').run(durum ? 1 : 0, kullanici_id);
  res.json({ basari: true });
});

// Chat geçmişi
app.get('/api/admin/chat-gecmis', adminGerektir, (req, res) => {
  const { gun, saat } = req.query;
  let sorgu = 'SELECT cm.*, k.nick FROM chat_mesajlari cm LEFT JOIN kullanicilar k ON cm.kullanici_id = k.id WHERE 1=1';
  const params = [];
  if (gun) { sorgu += ' AND DATE(cm.tarih) = ?'; params.push(gun); }
  if (saat) { sorgu += ' AND strftime("%H", cm.tarih) = ?'; params.push(saat.padStart(2, '0')); }
  sorgu += ' ORDER BY cm.tarih DESC LIMIT 200';
  const mesajlar = db.prepare(sorgu).all(...params);
  res.json({ basari: true, mesajlar });
});

// İtem ayarları
app.get('/api/admin/itemlar', adminGerektir, (req, res) => {
  const itemlar = db.prepare('SELECT * FROM market_itemlari').all();
  res.json({ basari: true, itemlar });
});

app.post('/api/admin/item-guncelle', adminGerektir, (req, res) => {
  const { id, isim, aciklama, fiyat, para_birimi, kullanim_hakki, aktif } = req.body;
  db.prepare('UPDATE market_itemlari SET isim=?, aciklama=?, fiyat=?, para_birimi=?, kullanim_hakki=?, aktif=? WHERE id=?')
    .run(isim, aciklama, fiyat, para_birimi, kullanim_hakki, aktif ? 1 : 0, id);
  res.json({ basari: true });
});

// Jeton paketleri ayarları
app.get('/api/admin/jeton-paketleri', adminGerektir, (req, res) => {
  const paketler = db.prepare('SELECT * FROM jeton_paketleri').all();
  res.json({ basari: true, paketler });
});

app.post('/api/admin/paket-guncelle', adminGerektir, (req, res) => {
  const { id, fiyat, para_birimi, aktif } = req.body;
  db.prepare('UPDATE jeton_paketleri SET fiyat=?, para_birimi=?, aktif=? WHERE id=?')
    .run(fiyat, para_birimi, aktif ? 1 : 0, id);
  res.json({ basari: true });
});

// Para kopar ayarı
app.post('/api/admin/para-kopar-ayar', adminGerektir, (req, res) => {
  const { min_miktar, max_miktar } = req.body;
  db.prepare('UPDATE para_kopar_ayar SET min_miktar=?, max_miktar=? WHERE id=1').run(min_miktar, max_miktar);
  res.json({ basari: true });
});

app.get('/api/admin/para-kopar-ayar', adminGerektir, (req, res) => {
  const ayar = db.prepare('SELECT * FROM para_kopar_ayar WHERE id=1').get();
  res.json({ basari: true, ayar });
});

// ============================================================
// SOCKET.IO
// ============================================================

io.on('connection', (socket) => {
  // Session'dan kullanıcıyı al - cookie parse
  socket.on('auth', (data) => {
    if (data && data.kullanici_id) {
      const k = db.prepare('SELECT id, nick, jeton FROM kullanicilar WHERE id = ? AND yasak = 0').get(data.kullanici_id);
      if (k) {
        socket.kullanici = k;
        socket.join('oyun');
        // Mevcut grafik durumunu gönder
        socket.emit('grafik_guncelle', {
          deger: grafik.mevcutDegerAl(),
          zaman: Date.now(),
          gecmis: grafik.gecmisAl()
        });
        // Oyuncu listesini güncelle
        yayinlaOyuncular();
      }
    }
  });

  socket.on('chat_mesaj', (data) => {
    if (!socket.kullanici) return;
    const k = db.prepare('SELECT * FROM kullanicilar WHERE id = ?').get(socket.kullanici.id);
    if (!k || k.yasak || k.chat_yasak) return;

    const mesaj = String(data.mesaj).trim().substring(0, 200);
    if (!mesaj) return;

    db.prepare('INSERT INTO chat_mesajlari (kullanici_id, nick, mesaj) VALUES (?, ?, ?)').run(k.id, k.nick, mesaj);

    io.emit('chat_mesaj', {
      nick: k.nick,
      mesaj,
      tarih: new Date().toISOString()
    });
  });

  socket.on('disconnect', () => {
    yayinlaOyuncular();
  });
});

function yayinlaOyuncular() {
  const oyuncular = [];
  io.sockets.sockets.forEach(socket => {
    if (socket.kullanici) {
      const k = db.prepare('SELECT id, nick, jeton FROM kullanicilar WHERE id = ?').get(socket.kullanici.id);
      if (k) oyuncular.push({ id: k.id, nick: k.nick, jeton: k.jeton });
    }
  });
  const benzersiz = [...new Map(oyuncular.map(o => [o.id, o])).values()];
  io.emit('oyuncu_listesi', benzersiz);
}

// ============================================================
// SUNUCU BAŞLAT
// ============================================================

server.listen(PORT, () => {
  console.log(`🍵 DemliCoin sunucusu çalışıyor: http://localhost:${PORT}`);
  console.log(`🔧 Admin paneli: http://localhost:${PORT}/yonetbunları`);
});
