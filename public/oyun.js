// DemliCoin Oyun JS
const socket = io();
let kullanici = null;
let grafikGecmis = [];
let aktifBahis = null;
let canvas, ctx;
let coinIsmi = 'DemliCoin';
let coinKisaltma = 'DC';

// ─── INIT ───
async function init() {
  // Site ayarları
  try {
    const sa = await fetch('/api/site-ayarlari');
    const sad = await sa.json();
    if (sad.basari) {
      coinIsmi = sad.ayar.coin_ismi || 'DemliCoin';
      coinKisaltma = sad.ayar.coin_kisaltma || 'DC';
      document.title = coinIsmi;
      const logoText = document.getElementById('logo-text');
      if (logoText) logoText.textContent = coinIsmi;
      const grafSembol = document.getElementById('grafik-sembol');
      if (grafSembol) grafSembol.textContent = `${coinKisaltma} / JETON`;
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

  // Misafir ise üst bar güncelle
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
  mevcutDegerGuncelle(gd.mevcutDeger);
  grafikCiz();

  if (kullanici) {
    socket.emit('auth', { kullanici_id: kullanici.id });
    const cr = await fetch('/api/chat/gecmis');
    const cd = await cr.json();
    if (cd.basari) {
      cd.mesajlar.forEach(m => chatEkle(m.nick, m.mesaj, m.tarih, m.jeton, m.renk, m.sira));
      chatKaydirAsagi();
    }
  }

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

// ─── SOCKET ───
socket.on('grafik_guncelle', (data) => {
  grafikGecmis = data.gecmis || [];
  mevcutDegerGuncelle(data.deger);
  grafikCiz();
});
socket.on('oyuncu_listesi', oyuncuListesiGoster);
socket.on('chat_mesaj', (data) => { chatEkle(data.nick, data.mesaj, data.tarih, data.jeton, data.renk, data.sira); chatKaydirAsagi(); });
socket.on('jeton_guncelle', (data) => {
  if (kullanici && data.kullanici_id === kullanici.id) {
    kullanici.jeton = data.jeton;
    document.getElementById('jeton-miktar').textContent = data.jeton.toLocaleString('tr-TR');
  }
});
socket.on('yasaklandi', () => { alert('Hesabiniz yasaklanmistir.'); window.location.href = '/giris'; });

// ─── GRAFİK ───
function grafikCiz() {
  if (!canvas || !ctx || grafikGecmis.length < 2) return;
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  const degerler = grafikGecmis.map(g => g.deger);
  const minD = Math.min(...degerler) * 0.93;
  const maxD = Math.max(...degerler) * 1.07;
  const aralik = maxD - minD || 1;
  const padL = 48, padR = 10, padT = 14, padB = 24;
  const gW = w - padL - padR, gH = h - padT - padB;

  ctx.strokeStyle = 'rgba(255,255,255,0.04)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = padT + (gH / 4) * i;
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(padL + gW, y); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.font = '500 10px Inter,sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText((maxD - (aralik / 4) * i).toFixed(1), padL - 4, y + 4);
  }

  const ilk = degerler[0], son = degerler[degerler.length - 1];
  const yesil = son >= ilk;
  const rgb = yesil ? '16,185,129' : '239,68,68';

  const grad = ctx.createLinearGradient(0, padT, 0, padT + gH);
  grad.addColorStop(0, `rgba(${rgb},0.22)`);
  grad.addColorStop(1, `rgba(${rgb},0)`);

  ctx.beginPath();
  grafikGecmis.forEach((p, i) => {
    const x = padL + (i / (grafikGecmis.length - 1)) * gW;
    const y = padT + gH - ((p.deger - minD) / aralik) * gH;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.lineTo(padL + gW, padT + gH); ctx.lineTo(padL, padT + gH); ctx.closePath();
  ctx.fillStyle = grad; ctx.fill();

  ctx.beginPath();
  ctx.strokeStyle = `rgb(${rgb})`; ctx.lineWidth = 2;
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  grafikGecmis.forEach((p, i) => {
    const x = padL + (i / (grafikGecmis.length - 1)) * gW;
    const y = padT + gH - ((p.deger - minD) / aralik) * gH;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.stroke();

  const lastX = padL + gW;
  const lastY = padT + gH - ((son - minD) / aralik) * gH;
  ctx.beginPath(); ctx.arc(lastX, lastY, 4, 0, Math.PI * 2);
  ctx.fillStyle = `rgb(${rgb})`; ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1.5; ctx.stroke();
}

function mevcutDegerGuncelle(deger) {
  const el = document.getElementById('grafik-deger');
  const eski = parseFloat(el.dataset.deger || deger);
  el.dataset.deger = deger;
  el.textContent = deger.toFixed(2);
  el.className = 'canli-deger mono ' + (deger >= eski ? 'deger-yesil' : 'deger-kirmizi');
}

// ─── BAHİS ───
async function basBahistePara() {
  if (!kullanici) { window.location.href = '/kayit'; return; }
  if (aktifBahis) { bildirimGoster('Zaten aktif bir pozisyonunuz var!', false); return; }

  const miktar = parseInt(document.getElementById('bahis-miktar').value);
  if (!miktar || miktar < 1) { bildirimGoster('Gecerli bir miktar girin!', false); return; }
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

  // UI güncelle
  document.getElementById('bas-btn').style.display = 'none';
  document.getElementById('sat-btn').style.display = 'block';
  document.getElementById('bahis-panel').classList.add('aktif-pozisyon');
  document.getElementById('giris-degeri').textContent = d.girdigiDeger.toFixed(2);
  document.getElementById('aktif-bilgi-wrap').style.display = 'flex';

  // Item efekt
  document.querySelectorAll('.item-chip').forEach(c => c.classList.add('item-parlak'));

  bildirimGoster(`Pozisyon acildi — ${miktar} jeton`, true);
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

function resetBahis() {
  aktifBahis = null;
  document.getElementById('bas-btn').style.display = 'block';
  document.getElementById('sat-btn').style.display = 'none';
  document.getElementById('bahis-panel').classList.remove('aktif-pozisyon');
  document.getElementById('aktif-bilgi-wrap').style.display = 'none';
  document.querySelectorAll('.item-chip').forEach(c => c.classList.remove('item-parlak'));
}

function sonucGoster(kazanc) {
  const overlay = document.getElementById('sonuc-overlay');
  const rakam = document.getElementById('sonuc-rakam');
  if (!overlay || !rakam) return;
  const pozitif = kazanc > 0;
  rakam.textContent = pozitif ? `+${kazanc.toLocaleString('tr-TR')}` : kazanc.toLocaleString('tr-TR');
  rakam.className = 'sonuc-rakam ' + (pozitif ? 'pozitif' : kazanc === 0 ? 'sifir' : 'negatif');
  overlay.style.display = 'flex';
  setTimeout(() => { overlay.style.display = 'none'; }, 3000);
}

function hizliMiktar(m) {
  const el = document.getElementById('bahis-miktar');
  if (el) el.value = m;
}

// ─── PROMOSYON ───
async function promoKullan() {
  if (!kullanici) { window.location.href = '/giris'; return; }
  const kod = document.getElementById('promo-input').value.trim();
  if (!kod) return;
  const r = await fetch('/api/promosyon/kullan', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ kod })
  });
  const d = await r.json();
  bildirimGoster(d.mesaj, d.basari);
  if (d.basari) {
    kullanici.jeton = d.yeniJeton;
    guncelleBilgi();
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
  bildirimGoster(d.basari ? `${d.hedefNick} oyuncusundan ${d.calinanMiktar} jeton alindi` : d.mesaj, d.basari);
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
    div.innerHTML = `<span class="oyuncu-nick" style="color:${renk}">${benim ? '▶ ' : ''}${escapeHtml(o.nick)}</span><span class="oyuncu-jeton">${o.jeton.toLocaleString('tr-TR')}</span>`;
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
function chatEkle(nick, mesaj, tarih, jeton, renk, sira) {
  const div = document.getElementById('chat-mesajlar');
  if (!div) return;
  const saatStr = new Date(tarih).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  const benim = kullanici && nick === kullanici.nick;
  const nickRenk = renk || nickRenkAl(nick);
  const el = document.createElement('div');
  el.className = 'chat-satir' + (benim ? ' benim-chat' : '');
  el.innerHTML = `<span class="chat-zaman">${saatStr}</span><span class="chat-nick" style="color:${nickRenk}">${escapeHtml(nick)}</span><span class="chat-meta">#${sira||'?'} · ${(jeton||0).toLocaleString('tr-TR')}</span><span class="chat-metin">${escapeHtml(mesaj)}</span>`;
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
