// DemliCoin Oyun JS
const socket = io();
let kullanici = null;
let grafikGecmis = [];
let hedefGecmis = [];
let aktifBahis = null;
let canvas, ctx;
let coinIsmi = 'DemliCoin';
let coinKisaltma = 'DC';
let minBahis = 150;
let animFrame = null;
let animBaslangic = null;
const ANIM_SURE = 500;
let eskiGecmis = [];
let turBitis = null;
let turInterval = null;

// ─── INIT ───
async function init() {
  try {
    const sa = await fetch('/api/site-ayarlari');
    const sad = await sa.json();
    if (sad.basari) {
      coinIsmi = sad.ayar.coin_ismi || 'DemliCoin';
      coinKisaltma = sad.ayar.coin_kisaltma || 'DC';
      minBahis = sad.ayar.min_bahis || 150;
      document.title = coinIsmi;
      const lt = document.getElementById('logo-text'); if (lt) lt.textContent = coinIsmi;
      const gs = document.getElementById('grafik-sembol'); if (gs) gs.textContent = `${coinKisaltma} / JETON`;
      const minEl = document.getElementById('min-bahis-goster'); if (minEl) minEl.textContent = `Min: ${minBahis}`;
      const bi = document.getElementById('bahis-miktar'); if (bi) { bi.min = minBahis; bi.value = minBahis; }
    }
  } catch(e) {}

  const r = await fetch('/api/benim-bilgilerim');
  if (r.ok) {
    const d = await r.json();
    if (d.basari) {
      kullanici = d.kullanici;
      guncelleBilgi();
      itemBarGuncelle(d.itemler);
      document.getElementById('giris-uyari').style.display = 'none';
      document.getElementById('bahis-panel').style.display = 'block';
    }
  }

  if (!kullanici) {
    const kb = document.getElementById('kullanici-bilgi-alan');
    const ma = document.getElementById('misafir-alan');
    if (kb) kb.style.display = 'none';
    if (ma) ma.style.display = 'flex';
  }

  canvas = document.getElementById('grafik-canvas');
  ctx = canvas.getContext('2d');
  boyutlandirCanvas();
  window.addEventListener('resize', boyutlandirCanvas);

  const gr = await fetch('/api/grafik-durumu');
  const gd = await gr.json();
  grafikGecmis = gd.gecmis || [];
  hedefGecmis = grafikGecmis.slice();
  mevcutDegerGuncelle(gd.mevcutDeger);
  if (gd.turBitis) { turBitis = gd.turBitis; turSayacBaslat(); }
  grafikCiz();

  if (kullanici) {
    socket.emit('auth', { kullanici_id: kullanici.id });
    const cr = await fetch('/api/chat/gecmis');
    const cd = await cr.json();
    if (cd.basari) { cd.mesajlar.forEach(m => chatEkle(m.id, m.nick, m.mesaj, m.tarih, m.jeton, m.renk, m.sira)); chatKaydirAsagi(); }
  }

  // Duyurular
  const dr = await fetch('/api/duyurular');
  const dd = await dr.json();
  if (dd.basari) dd.duyurular.forEach(d => duyuruGoster(d));

  document.getElementById('chat-input').addEventListener('keydown', e => { if (e.key === 'Enter') mesajGonder(); });
}

function guncelleBilgi() {
  if (!kullanici) return;
  document.getElementById('hosgeldin-nick').textContent = kullanici.nick;
  document.getElementById('jeton-miktar').textContent = kullanici.jeton.toLocaleString('tr-TR');
}

function boyutlandirCanvas() {
  if (!canvas) return;
  canvas.width = canvas.parentElement.clientWidth;
  canvas.height = window.innerWidth < 640 ? 180 : 260;
  grafikCiz();
}

// ─── TUR SAYACI ───
function turSayacBaslat() {
  if (turInterval) clearInterval(turInterval);
  turInterval = setInterval(() => {
    if (!turBitis) return;
    const kalan = Math.max(0, Math.ceil((turBitis - Date.now()) / 1000));
    const el = document.getElementById('tur-sayac');
    const ring = document.getElementById('tur-ring');
    if (!el) return;

    const ayarSuresi = 60; // fallback
    const oran = kalan / ayarSuresi;
    el.textContent = kalan > 0 ? `${kalan}s` : '—';

    // Ring rengi
    if (kalan <= 10) { el.style.color = '#ef4444'; if (ring) ring.style.borderColor = '#ef4444'; }
    else if (kalan <= 20) { el.style.color = '#f0b429'; if (ring) ring.style.borderColor = '#f0b429'; }
    else { el.style.color = '#10b981'; if (ring) ring.style.borderColor = '#10b981'; }

    if (kalan === 0) clearInterval(turInterval);
  }, 250);
}

// ─── SOCKET ───
socket.on('grafik_guncelle', (data) => {
  eskiGecmis = grafikGecmis.slice();
  hedefGecmis = data.gecmis || [];
  mevcutDegerGuncelle(data.deger);
  if (data.turBitis && data.turBitis !== turBitis) { turBitis = data.turBitis; turSayacBaslat(); }
  animBaslangic = null;
  if (animFrame) cancelAnimationFrame(animFrame);
  animFrame = requestAnimationFrame(animAdim);
});

socket.on('tur_basladi', (data) => {
  turBitis = data.turBitis;
  turSayacBaslat();
  turBildirim('YENİ TUR BAŞLADI', true);
});

socket.on('tur_bitti', () => {
  turBildirim('TUR BİTTİ', false);
  // Aktif bahis varsa zorla sat
  if (aktifBahis) zorunluSat();
});

socket.on('oyuncu_listesi', oyuncuListesiGoster);

socket.on('chat_mesaj', (data) => {
  chatEkle(data.id, data.nick, data.mesaj, data.tarih, data.jeton, data.renk, data.sira);
  chatKaydirAsagi();
});

socket.on('chat_mesaj_silindi', (data) => {
  const el = document.getElementById(`cm-${data.id}`);
  if (el) el.remove();
});

socket.on('chat_temizlendi', () => {
  const div = document.getElementById('chat-mesajlar');
  if (div) div.innerHTML = '';
});

socket.on('jeton_guncelle', (data) => {
  if (kullanici && data.kullanici_id === kullanici.id) {
    kullanici.jeton = data.jeton;
    document.getElementById('jeton-miktar').textContent = data.jeton.toLocaleString('tr-TR');
  }
});

socket.on('yasaklandi', () => { alert('Hesabiniz yasaklanmistir.'); window.location.href = '/giris'; });
socket.on('yeni_duyuru', (d) => duyuruGoster(d));
socket.on('mevcut_duyurular', (duyurular) => duyurular.forEach(d => duyuruGoster(d)));
socket.on('duyuru_silindi', (data) => {
  const el = document.getElementById(`duyuru-${data.id}`);
  if (el) el.remove();
});

// ─── TUR BİTTİ BİLDİRİM ───
function turBildirim(mesaj, basladi) {
  const el = document.getElementById('tur-bildirim');
  if (!el) return;
  el.textContent = mesaj;
  el.className = `tur-bildirim ${basladi ? 'tur-yeni' : 'tur-bitti-cls'}`;
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, 2500);
}

// ─── GRAFİK ANİMASYON ───
function animAdim(timestamp) {
  if (!animBaslangic) animBaslangic = timestamp;
  const t = Math.min((timestamp - animBaslangic) / ANIM_SURE, 1);
  const ease = 1 - Math.pow(1 - t, 3);

  if (eskiGecmis.length === 0 || hedefGecmis.length === 0) { grafikGecmis = hedefGecmis; grafikCiz(); return; }

  const gecmis = hedefGecmis.slice(0, -1);
  const sonH = hedefGecmis[hedefGecmis.length - 1];
  const sonE = eskiGecmis[eskiGecmis.length - 1] || sonH;
  grafikGecmis = [...gecmis, { deger: sonE.deger + (sonH.deger - sonE.deger) * ease, zaman: sonH.zaman }];
  grafikCiz();

  if (t < 1) animFrame = requestAnimationFrame(animAdim);
  else { grafikGecmis = hedefGecmis; grafikCiz(); }
}

function grafikCiz() {
  if (!canvas || !ctx || grafikGecmis.length < 2) return;
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  const degerler = grafikGecmis.map(g => g.deger);
  const minD = Math.min(...degerler) * 0.93;
  const maxD = Math.max(...degerler) * 1.07;
  const aralik = maxD - minD || 1;
  const padL = 52, padR = 10, padT = 14, padB = 28;
  const gW = w - padL - padR, gH = h - padT - padB;

  // Grid
  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = padT + (gH / 4) * i;
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(padL + gW, y); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = '600 11px JetBrains Mono, monospace';
    ctx.textAlign = 'right';
    ctx.fillText((maxD - (aralik / 4) * i).toFixed(0), padL - 6, y + 4);
  }

  const ilk = degerler[0], son = degerler[degerler.length - 1];
  const yesil = son >= ilk;
  const rgb = yesil ? '16,185,129' : '239,68,68';

  const grad = ctx.createLinearGradient(0, padT, 0, padT + gH);
  grad.addColorStop(0, `rgba(${rgb},0.25)`);
  grad.addColorStop(1, `rgba(${rgb},0.01)`);
  ctx.beginPath();
  grafikGecmis.forEach((p, i) => {
    const x = padL + (i / (grafikGecmis.length - 1)) * gW;
    const y = padT + gH - ((p.deger - minD) / aralik) * gH;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.lineTo(padL + gW, padT + gH); ctx.lineTo(padL, padT + gH); ctx.closePath();
  ctx.fillStyle = grad; ctx.fill();

  ctx.beginPath();
  ctx.strokeStyle = `rgb(${rgb})`; ctx.lineWidth = 2.5;
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  grafikGecmis.forEach((p, i) => {
    const x = padL + (i / (grafikGecmis.length - 1)) * gW;
    const y = padT + gH - ((p.deger - minD) / aralik) * gH;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.stroke();

  // Son nokta + değer etiketi
  const lastX = padL + gW;
  const lastY = padT + gH - ((son - minD) / aralik) * gH;
  ctx.beginPath(); ctx.arc(lastX, lastY, 5, 0, Math.PI * 2);
  ctx.fillStyle = `rgb(${rgb})`; ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 2; ctx.stroke();

  // Sağda fiyat etiketi
  ctx.fillStyle = `rgba(${rgb},0.9)`;
  ctx.fillRect(lastX + 6, lastY - 10, 52, 20);
  ctx.fillStyle = '#fff';
  ctx.font = '700 11px JetBrains Mono, monospace';
  ctx.textAlign = 'left';
  ctx.fillText(son.toFixed(1), lastX + 10, lastY + 4);

  // Aktif bahis giriş çizgisi
  if (aktifBahis && aktifBahis.girdigiDeger) {
    const girisY = padT + gH - ((aktifBahis.girdigiDeger - minD) / aralik) * gH;
    if (girisY >= padT && girisY <= padT + gH) {
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = 'rgba(240,180,41,0.6)';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(padL, girisY); ctx.lineTo(padL + gW, girisY); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(240,180,41,0.85)';
      ctx.font = '600 10px JetBrains Mono, monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`Giris: ${aktifBahis.girdigiDeger.toFixed(1)}`, padL + 4, girisY - 4);
    }
  }
}

function mevcutDegerGuncelle(deger) {
  const el = document.getElementById('grafik-deger');
  const eski = parseFloat(el.dataset.deger || deger);
  el.dataset.deger = deger;
  el.textContent = deger.toFixed(2);
  el.className = 'canli-deger mono ' + (deger >= eski ? 'deger-yesil' : 'deger-kirmizi');

  // Anlık P&L göster
  if (aktifBahis) anlikPLGuncelle(deger);
}

function anlikPLGuncelle(mevcutDeger) {
  if (!aktifBahis) return;
  const el = document.getElementById('anlik-pl');
  if (!el) return;
  const oran = (mevcutDeger - aktifBahis.girdigiDeger) / aktifBahis.girdigiDeger;
  const kazanc = Math.round(aktifBahis.miktar * oran);
  el.textContent = kazanc >= 0 ? `+${kazanc.toLocaleString('tr-TR')}` : kazanc.toLocaleString('tr-TR');
  el.className = 'anlik-pl ' + (kazanc >= 0 ? 'pl-pozitif' : 'pl-negatif');
}

// ─── BAHİS ───
async function basBahistePara() {
  if (!kullanici) { window.location.href = '/kayit'; return; }
  if (aktifBahis) { bildirimGoster('Zaten aktif pozisyon var!', false); return; }
  if (turBitis && Date.now() >= turBitis) { bildirimGoster('Tur bitti, yeni tur bekle!', false); return; }

  const miktar = parseInt(document.getElementById('bahis-miktar').value);
  if (!miktar || miktar < 1) { bildirimGoster('Gecerli miktar girin!', false); return; }
  if (miktar < minBahis) { bildirimGoster(`Minimum bahis ${minBahis.toLocaleString('tr-TR')} jetondur!`, false); return; }
  if (miktar > kullanici.jeton) { bildirimGoster('Yetersiz jeton!', false); return; }

  const r = await fetch('/api/bahis', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jeton_miktari: miktar, yon: 'yukari' })
  });
  const d = await r.json();
  if (!d.basari) { bildirimGoster(d.mesaj, false); return; }

  aktifBahis = { id: d.bahisId, miktar, girdigiDeger: d.girdigiDeger };
  kullanici.jeton -= miktar;
  guncelleBilgi();

  document.getElementById('bas-btn').style.display = 'none';
  document.getElementById('sat-btn').style.display = 'block';
  document.getElementById('bahis-panel').classList.add('aktif-pozisyon');
  document.getElementById('giris-degeri').textContent = d.girdigiDeger.toFixed(2);
  document.getElementById('aktif-bilgi-wrap').style.display = 'flex';
  document.querySelectorAll('.item-chip').forEach(c => c.classList.add('item-parlak'));
  bildirimGoster(`Pozisyon acildi — ${miktar.toLocaleString('tr-TR')} jeton @ ${d.girdigiDeger.toFixed(2)}`, true);
}

async function satisYap() {
  if (!aktifBahis) return;
  const r = await fetch('/api/sat', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bahis_id: aktifBahis.id })
  });
  const d = await r.json();
  if (!d.basari) { bildirimGoster(d.mesaj, false); return; }
  kullanici.jeton = d.yeniJeton;
  guncelleBilgi();
  sonucGoster(d.kazanc);
  resetBahis();
  const info = await fetch('/api/benim-bilgilerim');
  const iData = await info.json();
  if (iData.basari) itemBarGuncelle(iData.itemler);
}

async function zorunluSat() {
  if (!aktifBahis) return;
  const r = await fetch('/api/sat', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bahis_id: aktifBahis.id, zorunlu: true })
  });
  const d = await r.json();
  if (d.basari) {
    kullanici.jeton = d.yeniJeton;
    guncelleBilgi();
    sonucGoster(d.kazanc, true);
    resetBahis();
  }
}

function resetBahis() {
  aktifBahis = null;
  document.getElementById('bas-btn').style.display = 'block';
  document.getElementById('sat-btn').style.display = 'none';
  document.getElementById('bahis-panel').classList.remove('aktif-pozisyon');
  document.getElementById('aktif-bilgi-wrap').style.display = 'none';
  document.querySelectorAll('.item-chip').forEach(c => c.classList.remove('item-parlak'));
  const pl = document.getElementById('anlik-pl');
  if (pl) pl.textContent = '';
}

function sonucGoster(kazanc, zorunlu) {
  const overlay = document.getElementById('sonuc-overlay');
  const rakam = document.getElementById('sonuc-rakam');
  const alt = document.getElementById('sonuc-alt');
  if (!overlay || !rakam) return;
  rakam.textContent = kazanc >= 0 ? `+${kazanc.toLocaleString('tr-TR')}` : kazanc.toLocaleString('tr-TR');
  rakam.className = 'sonuc-rakam ' + (kazanc > 0 ? 'pozitif' : kazanc < 0 ? 'negatif' : 'sifir');
  if (alt) alt.textContent = zorunlu ? 'TUR BİTTİ — JETON' : 'JETON';
  overlay.style.display = 'flex';
  setTimeout(() => { overlay.style.display = 'none'; }, 1500);
}

function hizliMiktar(m) { const el = document.getElementById('bahis-miktar'); if (el) el.value = m; }

// ─── DUYURU ───
const aktifDuyurular = new Map();

function duyuruGoster(d) {
  if (aktifDuyurular.has(d.id)) return;
  const kapsayici = document.getElementById('duyuru-kapsayici');
  if (!kapsayici) return;

  const el = document.createElement('div');
  el.id = `duyuru-${d.id}`;
  el.className = `duyuru-karti duyuru-${d.renk || 'gold'}`;
  el.innerHTML = `
    <div class="duyuru-ic">
      <span class="duyuru-baslik">${escapeHtml(d.baslik)}</span>
      <span class="duyuru-icerik">${escapeHtml(d.icerik)}</span>
    </div>
    <button class="duyuru-kapat" onclick="duyuruKapat(${d.id})">×</button>
  `;
  kapsayici.appendChild(el);
  aktifDuyurular.set(d.id, el);

  // Otomatik kapat (sure_dk > 0 ise)
  if (d.sure_dk > 0) {
    setTimeout(() => duyuruKapat(d.id), d.sure_dk * 60 * 1000);
  }
}

function duyuruKapat(id) {
  const el = document.getElementById(`duyuru-${id}`);
  if (el) { el.classList.add('duyuru-cikis'); setTimeout(() => el.remove(), 400); }
  aktifDuyurular.delete(id);
}

// ─── PROMOSYON ───
async function promoKullan() {
  if (!kullanici) { window.location.href = '/giris'; return; }
  const kod = document.getElementById('promo-input').value.trim();
  if (!kod) return;
  const r = await fetch('/api/promosyon/kullan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kod }) });
  const d = await r.json();
  bildirimGoster(d.mesaj, d.basari);
  if (d.basari) {
    kullanici.jeton = d.yeniJeton; guncelleBilgi();
    document.getElementById('promo-input').value = '';
    const info = await fetch('/api/benim-bilgilerim');
    const iData = await info.json();
    if (iData.basari) itemBarGuncelle(iData.itemler);
  }
}

// ─── İTEM BAR ───
function itemBarGuncelle(itemler) {
  const bar = document.getElementById('item-bar');
  if (!bar) return;
  bar.innerHTML = '';
  if (!itemler || itemler.length === 0) return;
  const isimler = { 'iki_kat_kar': '2X KAR', 'zarar_kalkan': 'ZARAR KALKANI', 'para_kopar': 'PARA KOPAR' };
  itemler.forEach(item => {
    const div = document.createElement('div');
    div.className = 'item-chip';
    div.innerHTML = `<span class="item-chip-isim">${isimler[item.item_kod] || item.item_kod}</span><span class="item-chip-sayi">${item.kalan_kullanim}x</span>`;
    if (item.item_kod === 'para_kopar') div.onclick = () => paraKopar();
    bar.appendChild(div);
  });
}

async function paraKopar() {
  if (!kullanici) return;
  const r = await fetch('/api/para-kopar', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
  const d = await r.json();
  bildirimGoster(d.basari ? `${d.hedefNick} hedefinden ${d.calinanMiktar.toLocaleString('tr-TR')} jeton alindi` : d.mesaj, d.basari);
  if (d.basari) {
    kullanici.jeton = d.yeniJeton; guncelleBilgi();
    const info = await fetch('/api/benim-bilgilerim');
    const iData = await info.json();
    if (iData.basari) itemBarGuncelle(iData.itemler);
  }
}

// ─── OYUNCU LİSTESİ ───
function oyuncuListesiGoster(oyuncular) {
  const liste = document.getElementById('oyuncu-listesi');
  const sayac = document.getElementById('oyuncu-sayisi');
  if (!liste || !sayac) return;
  sayac.textContent = oyuncular.length;
  liste.innerHTML = '';
  [...oyuncular].sort((a, b) => b.jeton - a.jeton).forEach(o => {
    const benim = kullanici && o.id === kullanici.id;
    const renk = o.renk || nickRenkAl(o.nick);
    const div = document.createElement('div');
    div.className = 'oyuncu-satir' + (benim ? ' benim-oyuncu' : '');
    div.innerHTML = `
      <span class="oyuncu-nick" style="color:${renk}">${benim ? '▶ ' : ''}${escapeHtml(o.nick)}</span>
      <span class="oyuncu-jeton mono"><img src="/coin.svg" class="coin-img" style="width:11px;height:11px;vertical-align:middle;margin-right:2px;" />${o.jeton.toLocaleString('tr-TR')}</span>
    `;
    liste.appendChild(div);
  });
}

function nickRenkAl(nick) {
  const renkler = ['#e879f9','#a78bfa','#60a5fa','#34d399','#fbbf24','#f87171','#fb923c','#38bdf8','#4ade80','#c084fc','#f472b6','#818cf8','#2dd4bf','#facc15','#fb7185'];
  let hash = 0;
  for (let i = 0; i < nick.length; i++) hash = nick.charCodeAt(i) + ((hash << 5) - hash);
  return renkler[Math.abs(hash) % renkler.length];
}

// ─── CHAT ───
function chatEkle(id, nick, mesaj, tarih, jeton, renk, sira) {
  const div = document.getElementById('chat-mesajlar');
  if (!div) return;
  const saatStr = new Date(tarih).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  const benim = kullanici && nick === kullanici.nick;
  const nickRenk = renk || nickRenkAl(nick);
  const el = document.createElement('div');
  el.className = 'chat-satir' + (benim ? ' benim-chat' : '');
  el.id = `cm-${id}`;
  el.innerHTML = `
    <span class="chat-zaman">${saatStr}</span>
    <span class="chat-nick" style="color:${nickRenk}">${escapeHtml(nick)}</span>
    <span class="chat-meta">#${sira||'?'} · ${(jeton||0).toLocaleString('tr-TR')}</span>
    <span class="chat-metin">${escapeHtml(mesaj)}</span>
  `;
  div.appendChild(el);
  if (div.children.length > 120) div.firstChild.remove();
}

function chatKaydirAsagi() { const d = document.getElementById('chat-mesajlar'); if (d) d.scrollTop = d.scrollHeight; }

function mesajGonder() {
  if (!kullanici) { window.location.href = '/giris'; return; }
  const input = document.getElementById('chat-input');
  const mesaj = input.value.trim();
  if (!mesaj) return;
  socket.emit('chat_mesaj', { mesaj });
  input.value = '';
}

function bildirimGoster(mesaj, basari) {
  const el = document.getElementById('bildirim-bar');
  if (!el) return;
  el.textContent = mesaj;
  el.className = 'bildirim-bar ' + (basari ? 'bildirim-ok' : 'bildirim-hata');
  el.style.display = 'block';
  setTimeout(() => el.style.display = 'none', 3500);
}

function escapeHtml(str) { return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
async function cikisYap() { await fetch('/api/cikis',{method:'POST'}); window.location.href='/giris'; }

init();
