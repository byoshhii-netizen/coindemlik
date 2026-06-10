// DemliCoin Cark JS
let kullanici = null;
let carklar = [];
let aktifCark = null;
let donuyor = false;
let mevcutAci = 0;

const DILIM_RENKLERI = [
  '#1e1e3a','#2a1f3d','#1a2a3a','#1f2d1f','#2d1f1f',
  '#1a1a2e','#2e1a2e','#1a2e1a','#2e2e1a','#1a2a2a'
];
const DILIM_RENK_PARLAK = [
  '#4a4a9a','#7a4a9a','#4a7a9a','#4a9a4a','#9a4a4a',
  '#4a4a7a','#7a4a7a','#4a7a4a','#7a7a4a','#4a7a7a'
];

// ─── INIT ───
async function init() {
  try {
    const r = await fetch('/api/benim-bilgilerim');
    if (r.ok) {
      const d = await r.json();
      if (d.basari) {
        kullanici = d.kullanici;
        document.getElementById('hosgeldin-nick').textContent = kullanici.nick;
        document.getElementById('jeton-miktar').textContent = kullanici.jeton.toLocaleString('tr-TR');
      }
    }
  } catch(e) {}

  if (!kullanici) {
    document.getElementById('kullanici-bilgi-alan').style.display = 'none';
    document.getElementById('misafir-alan').style.display = 'flex';
  }

  try {
    const r = await fetch('/api/cark/ayarlar');
    const d = await r.json();
    if (d.basari) {
      carklar = d.carklar.filter(c => c.aktif);
      tipBarDoldur();
      if (carklar.length > 0) {
        aktifCark = carklar[0];
        carkSec(carklar[0].id);
      }
    }
  } catch(e) {}
}

// ─── TİP BAR ───
function tipBarDoldur() {
  const bar = document.getElementById('cark-tip-bar');
  bar.innerHTML = '';
  carklar.forEach((c, i) => {
    const btn = document.createElement('button');
    btn.className = 'cark-tip-btn' + (i === 0 ? ' cark-tip-aktif' : '');
    btn.dataset.id = c.id;
    btn.innerHTML = `
      <span class="cark-tip-isim">${c.isim.toUpperCase()}</span>
      <span class="cark-tip-fiyat">${c.fiyat.toLocaleString('tr-TR')} JETON</span>
    `;
    btn.addEventListener('click', () => {
      if (donuyor) return;
      document.querySelectorAll('.cark-tip-btn').forEach(b => b.classList.remove('cark-tip-aktif'));
      btn.classList.add('cark-tip-aktif');
      carkSec(c.id);
    });
    bar.appendChild(btn);
  });
}

function carkSec(id) {
  aktifCark = carklar.find(c => c.id === id) || carklar[0];
  if (!aktifCark) return;
  document.getElementById('cark-aktif-tip').textContent = aktifCark.isim.toUpperCase();
  document.getElementById('cark-aktif-fiyat').textContent = aktifCark.fiyat.toLocaleString('tr-TR');
  const btnJeton = document.getElementById('cark-btn-jeton');
  if (btnJeton) btnJeton.textContent = `${aktifCark.fiyat.toLocaleString('tr-TR')} JETON`;
  mevcutAci = 0;
  carkCiz(mevcutAci);
  odulTablosunuDoldur();
}

// ─── ÇARK ÇİZ — EŞİT DİLİMLER ───
function carkCiz(donmusAci) {
  const canvas = document.getElementById('cark-canvas');
  if (!canvas || !aktifCark) return;
  const ctx = canvas.getContext('2d');
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  const r = cx - 8;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const dilimler = aktifCark.dilimler;
  if (!dilimler || dilimler.length === 0) return;

  // HER DİLİM EŞİT AÇIDA — görsel olarak
  const n = dilimler.length;
  const dilimAci = (2 * Math.PI) / n;

  // 1. Önce tüm dilim alanlarını çiz
  for (let i = 0; i < n; i++) {
    const bas = donmusAci - Math.PI / 2 + i * dilimAci;
    const bit = bas + dilimAci;
    const renk = DILIM_RENKLERI[i % DILIM_RENKLERI.length];
    const parlak = DILIM_RENK_PARLAK[i % DILIM_RENK_PARLAK.length];
    const ortaAci = bas + dilimAci / 2;

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, bas, bit);
    ctx.closePath();

    const grad = ctx.createRadialGradient(
      cx + Math.cos(ortaAci) * r * 0.4,
      cy + Math.sin(ortaAci) * r * 0.4,
      0, cx, cy, r
    );
    grad.addColorStop(0, parlak);
    grad.addColorStop(1, renk);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // 2. Metinleri çiz — dilim ortasına, radyal yönde
  for (let i = 0; i < n; i++) {
    const bas = donmusAci - Math.PI / 2 + i * dilimAci;
    const ortaAci = bas + dilimAci / 2;
    const d = dilimler[i];

    const textR = r * 0.63;
    const tx = cx + Math.cos(ortaAci) * textR;
    const ty = cy + Math.sin(ortaAci) * textR;

    ctx.save();
    ctx.translate(tx, ty);
    // Merkez dışa bak, her zaman yukarı dönük
    ctx.rotate(ortaAci + Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.95)';
    ctx.shadowBlur = 5;

    const isIflas = d.iflas || (d.isim && d.isim.toUpperCase().includes('IFLAS'));
    ctx.fillStyle = isIflas ? '#f87171' : '#ffffff';
    ctx.font = '800 12px Inter, sans-serif';
    ctx.fillText(d.isim, 0, -6);

    ctx.font = '600 10px JetBrains Mono, monospace';
    ctx.fillStyle = isIflas ? 'rgba(248,113,113,0.85)' : 'rgba(255,255,255,0.65)';
    const altMetin = d.jeton > 0 ? `+${d.jeton.toLocaleString('tr-TR')}` : (isIflas ? `-${d.jeton}` : '--');
    ctx.fillText(altMetin, 0, 7);

    ctx.shadowBlur = 0;
    ctx.restore();
  }

  // 3. Dış halka
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, 2 * Math.PI);
  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.lineWidth = 3;
  ctx.stroke();

  // 4. İç daire
  ctx.beginPath();
  ctx.arc(cx, cy, 32, 0, 2 * Math.PI);
  ctx.fillStyle = '#0d0d1a';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 2;
  ctx.stroke();
}

// ─── ÇARK ÇEVİR ───
async function carkCevir() {
  if (donuyor) return;
  if (!kullanici) { window.location.href = '/giris'; return; }
  if (!aktifCark) return;

  if (kullanici.jeton < aktifCark.fiyat) {
    toast(`Yetersiz jeton! Gerekli: ${aktifCark.fiyat.toLocaleString('tr-TR')}`, false);
    return;
  }

  donuyor = true;
  const btn = document.getElementById('cark-cevir-btn');
  btn.disabled = true;
  document.getElementById('cark-btn-icerik').textContent = 'DONUYOR...';

  kullanici.jeton -= aktifCark.fiyat;
  document.getElementById('jeton-miktar').textContent = kullanici.jeton.toLocaleString('tr-TR');

  try {
    const r = await fetch('/api/cark/cevir', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cark_id: aktifCark.id })
    });
    const d = await r.json();

    if (!d.basari) {
      toast(d.mesaj, false);
      kullanici.jeton += aktifCark.fiyat;
      document.getElementById('jeton-miktar').textContent = kullanici.jeton.toLocaleString('tr-TR');
      donuyor = false;
      btn.disabled = false;
      document.getElementById('cark-btn-icerik').textContent = 'CARKI CEVİR';
      return;
    }

    // Eşit dilim açısı ile hedef hesapla
    const n = aktifCark.dilimler.length;
    const dilimAci = (2 * Math.PI) / n;
    // Hedef dilim ortası
    const dilimOrtaAci = (d.dilimIdx + 0.5) * dilimAci;
    // 5-8 tur + hedefe git
    const turSayisi = 5 + Math.floor(Math.random() * 4);
    const hedefAci = turSayisi * 2 * Math.PI - dilimOrtaAci;

    animasyonBaslat(hedefAci, () => {
      kullanici.jeton = d.yeniJeton;
      document.getElementById('jeton-miktar').textContent = d.yeniJeton.toLocaleString('tr-TR');

      const sonEl = document.getElementById('cark-son-kazanc');
      if (d.iflas) {
        sonEl.textContent = `IFLAS -${(d.cark_fiyat + d.iflasKayip).toLocaleString('tr-TR')}`;
        sonEl.style.color = '#f87171';
        iflasOverlay(d.iflasKayip, d.cark_fiyat);
      } else if (d.net > 0) {
        sonEl.textContent = `+${d.net.toLocaleString('tr-TR')}`;
        sonEl.style.color = 'var(--green)';
        kazanOverlay(d.dilim, d.net);
      } else {
        sonEl.textContent = `-${d.cark_fiyat.toLocaleString('tr-TR')}`;
        sonEl.style.color = 'var(--red)';
        kayipOverlay(d.cark_fiyat);
      }

      donuyor = false;
      btn.disabled = false;
      document.getElementById('cark-btn-icerik').textContent = 'CARKI CEVİR';
    });

  } catch(e) {
    toast('Baglanti hatasi!', false);
    kullanici.jeton += aktifCark.fiyat;
    document.getElementById('jeton-miktar').textContent = kullanici.jeton.toLocaleString('tr-TR');
    donuyor = false;
    btn.disabled = false;
    document.getElementById('cark-btn-icerik').textContent = 'CARKI CEVİR';
  }
}

// ─── ANİMASYON ───
let animId = null;

function animasyonBaslat(hedefAci, callback) {
  const sure = 4500;
  const baslangic = performance.now();
  const baslangicAci = mevcutAci;

  function adim(now) {
    const gecen = now - baslangic;
    const t = Math.min(gecen / sure, 1);
    // Ease out quart — daha akıcı yavaşlama
    const ease = 1 - Math.pow(1 - t, 4);
    mevcutAci = baslangicAci + hedefAci * ease;
    carkCiz(mevcutAci);
    if (t < 1) {
      animId = requestAnimationFrame(adim);
    } else {
      mevcutAci = baslangicAci + hedefAci;
      carkCiz(mevcutAci);
      if (callback) setTimeout(callback, 250);
    }
  }
  animId = requestAnimationFrame(adim);
}

// ─── OVERLAY'LER ───
function kazanOverlay(dilim, net) {
  const el = document.getElementById('cark-overlay');
  const miktar = document.getElementById('cark-ov-miktar');
  document.getElementById('cark-ov-label').textContent = dilim.isim;
  miktar.textContent = `+${net.toLocaleString('tr-TR')}`;
  miktar.className = 'cark-overlay-miktar';
  document.getElementById('cark-ov-alt').textContent = 'JETON KAZANDIN';
  el.style.display = 'flex';
}

function kayipOverlay(carkFiyat) {
  const el = document.getElementById('cark-overlay');
  const miktar = document.getElementById('cark-ov-miktar');
  document.getElementById('cark-ov-label').textContent = 'BU SEFER OLMADI';
  miktar.textContent = `-${carkFiyat.toLocaleString('tr-TR')}`;
  miktar.className = 'cark-overlay-miktar kayip';
  document.getElementById('cark-ov-alt').textContent = 'JETON GITTI';
  el.style.display = 'flex';
}

function iflasOverlay(iflasKayip, carkFiyat) {
  const el = document.getElementById('cark-overlay');
  const miktar = document.getElementById('cark-ov-miktar');
  document.getElementById('cark-ov-label').textContent = 'IFLAS';
  miktar.textContent = `-${(carkFiyat + iflasKayip).toLocaleString('tr-TR')}`;
  miktar.className = 'cark-overlay-miktar kayip';
  document.getElementById('cark-ov-alt').textContent = `CARK (${carkFiyat.toLocaleString('tr-TR')}) + CEZA (${iflasKayip.toLocaleString('tr-TR')}) JETON`;
  el.style.display = 'flex';
  kayipEfekti();
}

function kayipEfekti() {
  const alan = document.querySelector('.cark-alan');
  if (!alan) return;
  alan.classList.add('cark-kayip');
  setTimeout(() => alan.classList.remove('cark-kayip'), 400);
}

// ─── ÖDÜL TABLOSU ───
function odulTablosunuDoldur() {
  const el = document.getElementById('cark-odul-tablo');
  if (!el || !aktifCark) return;
  el.innerHTML = aktifCark.dilimler.map((d, i) => {
    const isIflas = d.iflas || (d.isim && d.isim.toUpperCase().includes('IFLAS'));
    return `
      <div class="cark-odul-satir" style="--d-renk:${DILIM_RENK_PARLAK[i % DILIM_RENK_PARLAK.length]}">
        <span class="cark-odul-isim" style="${isIflas ? 'color:#f87171;' : ''}">${d.isim}</span>
        <span class="cark-odul-jeton mono">${d.jeton > 0 ? '+' + d.jeton.toLocaleString('tr-TR') + ' J' : (isIflas ? '-' + d.jeton + ' J' : '—')}</span>
        <span class="cark-odul-sans">%${d.sans}</span>
      </div>
    `;
  }).join('');
}

// ─── UTILS ───
function toast(msg, ok) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.className = 'toast ' + (ok ? 'toast-ok' : 'toast-err');
  el.style.display = 'block';
  setTimeout(() => el.style.display = 'none', 3000);
}

async function cikisYap() {
  await fetch('/api/cikis', { method: 'POST' });
  window.location.href = '/giris';
}

init();
