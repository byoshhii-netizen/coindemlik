// DemliCoin - Oyun JS
const socket = io();
let kullanici = null;
let grafikGecmis = [];
let aktifBahis = null;
let canvas, ctx;
let animFrame = null;

// ─────────────────── BAŞLAT ───────────────────
async function init() {
  const r = await fetch('/api/benim-bilgilerim');
  if (r.status === 401 || r.status === 302) { window.location.href = '/giris'; return; }
  if (!r.ok) { window.location.href = '/giris'; return; }
  const d = await r.json();
  if (!d.basari) { window.location.href = '/giris'; return; }
  kullanici = d.kullanici;

  document.getElementById('hosgeldin-nick').textContent = kullanici.nick;
  document.getElementById('jeton-miktar').textContent = kullanici.jeton.toLocaleString('tr-TR');

  // Socket auth
  socket.emit('auth', { kullanici_id: kullanici.id });

  // Grafik canvas ayarla
  canvas = document.getElementById('grafik-canvas');
  ctx = canvas.getContext('2d');
  boyutlandirCanvas();
  window.addEventListener('resize', boyutlandirCanvas);

  // Mevcut grafik durumunu çek
  const gr = await fetch('/api/grafik-durumu');
  const gd = await gr.json();
  grafikGecmis = gd.gecmis || [];
  mevcutDegerGoster(gd.mevcutDeger);
  grafikCiz();

  // Chat geçmişini yükle
  const cr = await fetch('/api/chat/gecmis');
  const cd = await cr.json();
  cd.mesajlar.forEach(m => chatEkle(m.nick, m.mesaj, m.tarih));
  chatKaydirAsagi();

  // İtem bar
  itemBarGuncelle(d.itemler);

  // Enter tuşu chat
  document.getElementById('chat-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') mesajGonder();
  });
}

function boyutlandirCanvas() {
  if (!canvas) return;
  const parent = canvas.parentElement;
  canvas.width = parent.clientWidth - 32;
  canvas.height = 240;
  grafikCiz();
}

// ─────────────────── SOCKEt OLAYLAR ───────────────────
socket.on('grafik_guncelle', (data) => {
  grafikGecmis = data.gecmis || [];
  mevcutDegerGoster(data.deger);
  grafikCiz();
  if (aktifBahis) anlikKazancGoster(data.deger);
});

socket.on('oyuncu_listesi', (oyuncular) => {
  oyuncuListesiGoster(oyuncular);
});

socket.on('chat_mesaj', (data) => {
  chatEkle(data.nick, data.mesaj, data.tarih);
  chatKaydirAsagi();
});

socket.on('jeton_guncelle', (data) => {
  if (data.kullanici_id === kullanici.id) {
    kullanici.jeton = data.jeton;
    document.getElementById('jeton-miktar').textContent = data.jeton.toLocaleString('tr-TR');
  }
});

socket.on('yasaklandi', () => {
  alert('Hesabınız yasaklanmıştır.');
  window.location.href = '/giris';
});

// ─────────────────── GRAFİK ÇİZ ───────────────────
function grafikCiz() {
  if (!canvas || !ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  if (grafikGecmis.length < 2) {
    ctx.fillStyle = '#4ade80';
    ctx.font = '16px sans-serif';
    ctx.fillText('Grafik yükleniyor...', w / 2 - 70, h / 2);
    return;
  }

  const degerler = grafikGecmis.map(g => g.deger);
  const minD = Math.min(...degerler) * 0.95;
  const maxD = Math.max(...degerler) * 1.05;
  const aralik = maxD - minD || 1;

  const padL = 55, padR = 15, padT = 20, padB = 30;
  const grafW = w - padL - padR;
  const grafH = h - padT - padB;

  // Arka plan grid
  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 5; i++) {
    const y = padT + (grafH / 5) * i;
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(padL + grafW, y); ctx.stroke();
    const deger = maxD - (aralik / 5) * i;
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '11px monospace';
    ctx.fillText(deger.toFixed(0), 2, y + 4);
  }

  // Gradient alan
  const grad = ctx.createLinearGradient(0, padT, 0, padT + grafH);
  const sonDeger = degerler[degerler.length - 1];
  const ilkDeger = degerler[0];
  const renk = sonDeger >= ilkDeger ? '74, 222, 128' : '248, 113, 113';
  grad.addColorStop(0, `rgba(${renk}, 0.3)`);
  grad.addColorStop(1, `rgba(${renk}, 0.0)`);

  ctx.beginPath();
  grafikGecmis.forEach((p, i) => {
    const x = padL + (i / (grafikGecmis.length - 1)) * grafW;
    const y = padT + grafH - ((p.deger - minD) / aralik) * grafH;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.lineTo(padL + grafW, padT + grafH);
  ctx.lineTo(padL, padT + grafH);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  // Ana çizgi
  ctx.beginPath();
  ctx.strokeStyle = `rgb(${renk})`;
  ctx.lineWidth = 2.5;
  ctx.lineJoin = 'round';
  grafikGecmis.forEach((p, i) => {
    const x = padL + (i / (grafikGecmis.length - 1)) * grafW;
    const y = padT + grafH - ((p.deger - minD) / aralik) * grafH;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.stroke();

  // Son nokta
  const lastX = padL + grafW;
  const lastY = padT + grafH - ((sonDeger - minD) / aralik) * grafH;
  ctx.beginPath();
  ctx.arc(lastX, lastY, 5, 0, Math.PI * 2);
  ctx.fillStyle = `rgb(${renk})`;
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.stroke();
}

function mevcutDegerGoster(deger) {
  const el = document.getElementById('grafik-deger');
  const eskiDeger = parseFloat(el.getAttribute('data-deger') || deger);
  el.setAttribute('data-deger', deger);
  el.textContent = deger.toFixed(2);
  el.style.color = deger >= eskiDeger ? '#4ade80' : '#f87171';
}

// ─────────────────── BAHİS ───────────────────
async function bahistePara(yon) {
  if (aktifBahis) { bildirimGoster('Zaten aktif bir bahsiniz var!', false); return; }
  const miktar = parseInt(document.getElementById('bahis-miktar').value);
  if (!miktar || miktar < 1) { bildirimGoster('Geçerli bir miktar girin!', false); return; }
  if (miktar > kullanici.jeton) { bildirimGoster('Yetersiz jeton!', false); return; }

  const r = await fetch('/api/bahis', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jeton_miktari: miktar, yon })
  });
  const d = await r.json();
  if (!d.basari) { bildirimGoster(d.mesaj, false); return; }

  aktifBahis = { id: d.bahisId, miktar, yon, girdigiDeger: d.girtigiDeger || d.girdigiDeger };
  kullanici.jeton -= miktar;
  document.getElementById('jeton-miktar').textContent = kullanici.jeton.toLocaleString('tr-TR');

  document.getElementById('bahis-panel').style.opacity = '0.5';
  const aktifDiv = document.getElementById('aktif-bahis');
  aktifDiv.style.display = 'flex';
  document.getElementById('aktif-miktar').textContent = miktar.toLocaleString('tr-TR');
  document.getElementById('aktif-giris-deger').textContent = (d.girdigiDeger || d.girtigiDeger || '?');

  bildirimGoster(`${miktar} jeton bahis girdiniz (${yon === 'yukari' ? '📈 Yükselir' : '📉 Düşer'})`, true);
}

async function satisYap() {
  if (!aktifBahis) return;
  const r = await fetch('/api/sat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bahis_id: aktifBahis.id })
  });
  const d = await r.json();
  if (!d.basari) { bildirimGoster(d.mesaj, false); return; }

  kullanici.jeton = d.yeniJeton;
  document.getElementById('jeton-miktar').textContent = d.yeniJeton.toLocaleString('tr-TR');

  const kazanc = d.kazanc;
  const mesaj = kazanc > 0 ? `+${kazanc.toLocaleString('tr-TR')} 🎉 Kâr!` : kazanc < 0 ? `${kazanc.toLocaleString('tr-TR')} 😢 Zarar` : `±0 Başabaş`;
  sonucGoster(kazanc, mesaj);

  aktifBahis = null;
  document.getElementById('bahis-panel').style.opacity = '1';
  document.getElementById('aktif-bahis').style.display = 'none';
  document.getElementById('anlik-kazan-goster').textContent = '';

  // İtem barını güncelle
  const info = await fetch('/api/benim-bilgilerim');
  const iData = await info.json();
  itemBarGuncelle(iData.itemler);
}

function anlikKazancGoster(mevcutDeger) {
  if (!aktifBahis) return;
  const giris = parseFloat(aktifBahis.girdigiDeger) || mevcutDeger;
  const miktar = aktifBahis.miktar;
  let oran;
  if (aktifBahis.yon === 'yukari') {
    oran = (mevcutDeger - giris) / giris;
  } else {
    oran = (giris - mevcutDeger) / giris;
  }
  const tahmini = Math.round(miktar * oran);
  const el = document.getElementById('anlik-kazan-goster');
  el.textContent = tahmini >= 0 ? `+${tahmini}` : `${tahmini}`;
  el.style.color = tahmini >= 0 ? '#4ade80' : '#f87171';
}

function sonucGoster(kazanc, mesaj) {
  const el = document.getElementById('sonuc-bildirim');
  el.className = `sonuc-bildirim sonuc-${kazanc > 0 ? 'kazan' : kazanc < 0 ? 'kayip' : 'basabas'}`;
  el.textContent = mesaj;
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, 3500);
}

// ─────────────────── İTEM BAR ───────────────────
function itemBarGuncelle(itemler) {
  const bar = document.getElementById('item-bar');
  bar.innerHTML = '';
  if (!itemler || itemler.length === 0) return;

  itemler.forEach(item => {
    const ikonlar = { 'iki_kat_kar': '💰', 'zarar_kalkan': '🛡️', 'para_kopar': '🔫' };
    const isimler = { 'iki_kat_kar': '2X Kâr', 'zarar_kalkan': 'Zarar Kalkanı', 'para_kopar': 'Para Kopar' };
    const btn = document.createElement('button');
    btn.className = 'item-bar-btn';
    btn.innerHTML = `${ikonlar[item.item_kod] || '🎁'} ${isimler[item.item_kod] || item.item_kod} <span class="item-kullanim-badge">${item.kalan_kullanim}x</span>`;
    if (item.item_kod === 'para_kopar') {
      btn.onclick = () => paraKopar();
    }
    bar.appendChild(btn);
  });
}

async function paraKopar() {
  const r = await fetch('/api/para-kopar', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
  const d = await r.json();
  if (d.basari) {
    bildirimGoster(`🔫 ${d.hedefNick} oyuncusundan ${d.calinanMiktar} jeton çaldın!`, true);
    kullanici.jeton = d.yeniJeton;
    document.getElementById('jeton-miktar').textContent = d.yeniJeton.toLocaleString('tr-TR');
    const info = await fetch('/api/benim-bilgilerim');
    const iData = await info.json();
    itemBarGuncelle(iData.itemler);
  } else {
    bildirimGoster(d.mesaj, false);
  }
}

// ─────────────────── OYUNCU LİSTESİ ───────────────────
function oyuncuListesiGoster(oyuncular) {
  const liste = document.getElementById('oyuncu-listesi');
  const sayac = document.getElementById('oyuncu-sayisi');
  sayac.textContent = oyuncular.length;
  liste.innerHTML = '';
  oyuncular.forEach(o => {
    const benim = kullanici && o.id === kullanici.id;
    const div = document.createElement('div');
    div.className = `oyuncu-satir ${benim ? 'benim-oyuncu' : ''}`;
    div.innerHTML = `
      <span class="oyuncu-nick">${benim ? '⭐ ' : ''}${o.nick}</span>
      <span class="oyuncu-jeton">🪙 ${o.jeton.toLocaleString('tr-TR')}</span>
    `;
    liste.appendChild(div);
  });
}

// ─────────────────── CHAT ───────────────────
function chatEkle(nick, mesaj, tarih) {
  const div = document.getElementById('chat-mesajlar');
  const tarihObj = new Date(tarih);
  const saatStr = tarihObj.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  const benim = kullanici && nick === kullanici.nick;
  const el = document.createElement('div');
  el.className = `chat-satir ${benim ? 'benim-chat' : ''}`;
  el.innerHTML = `<span class="chat-nick">${nick}</span><span class="chat-zaman">${saatStr}</span><span class="chat-metin">${escapeHtml(mesaj)}</span>`;
  div.appendChild(el);
  if (div.children.length > 100) div.firstChild.remove();
}

function chatKaydirAsagi() {
  const div = document.getElementById('chat-mesajlar');
  div.scrollTop = div.scrollHeight;
}

function mesajGonder() {
  const input = document.getElementById('chat-input');
  const mesaj = input.value.trim();
  if (!mesaj) return;
  socket.emit('chat_mesaj', { mesaj });
  input.value = '';
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ─────────────────── GENEL ───────────────────
function bildirimGoster(mesaj, basari) {
  const el = document.getElementById('sonuc-bildirim');
  el.className = `sonuc-bildirim ${basari ? 'sonuc-kazan' : 'sonuc-kayip'}`;
  el.textContent = mesaj;
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, 3000);
}

async function cikisYap() {
  await fetch('/api/cikis', { method: 'POST' });
  window.location.href = '/giris';
}

init();
