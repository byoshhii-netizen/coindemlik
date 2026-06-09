// DemliCoin Slot JS
let kullanici = null;
let slotAyar = null;
let aktifTip = 'normal';
let ceviriyor = false;

const SEMBOLLER = {
  normal: ['🍋','🍋','🍊','🍊','🍇','🍇','⭐','⭐','7️⃣','💎'],
  vip:    ['🔥','🔥','💰','💰','👑','👑','⚡','⚡','💎','7️⃣'],
  plus:   ['💎','💎','👑','👑','🚀','🚀','⚡','⚡','🌟','7️⃣']
};

const SEMBOL_AGIRLIK = {
  '🍋':3,'🍊':3,'🍇':3,'⭐':2,'7️⃣':1,'💎':1,
  '🔥':3,'💰':3,'👑':2,'⚡':2,
  '🚀':3,'🌟':1
};

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

  // Slot ayarları
  try {
    const r = await fetch('/api/slot/ayarlar');
    const d = await r.json();
    if (d.basari) {
      slotAyar = d.ayar;
      fiyatlariGuncelle();
      odemeTablosunuDoldur();
    }
  } catch(e) {}

  // Makaraları başlangıç sembolleriyle doldur
  for (let i = 0; i < 3; i++) trackDoldur(i, aktifTip);
}

// ─── MAKARA TRACK DOLDUR ───
function trackDoldur(makaraIdx, tip) {
  const track = document.getElementById(`track-${makaraIdx}`);
  if (!track) return;
  const semboller = SEMBOLLER[tip] || SEMBOLLER.normal;
  // 20 sembol üret (animasyon için yeterli)
  let html = '';
  for (let i = 0; i < 20; i++) {
    const s = semboller[Math.floor(Math.random() * semboller.length)];
    html += `<div class="slot-sembol">${s}</div>`;
  }
  track.innerHTML = html;
}

// ─── TİP SEÇ ───
function slotTipSec(tip, btn) {
  if (ceviriyor) return;

  // VIP/Plus kilitli mi?
  if (tip === 'vip' && slotAyar && !slotAyar.vip_aktif) {
    toast('VIP Slot şu an kapalı.', false); return;
  }
  if (tip === 'plus' && slotAyar && !slotAyar.plus_aktif) {
    toast('Plus+ Slot şu an kapalı.', false); return;
  }

  aktifTip = tip;

  // Buton stilleri
  document.querySelectorAll('.slot-tip-btn').forEach(b => b.classList.remove('slot-tip-aktif'));
  btn.classList.add('slot-tip-aktif');

  // Makine teması güncelle
  const makine = document.getElementById('slot-makine');
  makine.className = `slot-makine slot-makine-${tip}`;

  // Bilgi satırı güncelle
  const fiyat = slotAyar ? slotAyar[`${tip}_fiyat`] : (tip==='normal'?50:tip==='vip'?200:500);
  document.getElementById('aktif-tip-goster').textContent = tip.toUpperCase() + (tip==='plus'?'+':'');
  document.getElementById('aktif-bahis-goster').textContent = fiyat;

  // Makaraları yeni sembollerle doldur
  for (let i = 0; i < 3; i++) trackDoldur(i, tip);
}

// ─── FİYATLARI GÜNCELLE ───
function fiyatlariGuncelle() {
  if (!slotAyar) return;
  document.getElementById('fiyat-normal').textContent = `${slotAyar.normal_fiyat} Jeton`;
  document.getElementById('fiyat-vip').textContent = `${slotAyar.vip_fiyat} Jeton`;
  document.getElementById('fiyat-plus').textContent = `${slotAyar.plus_fiyat} Jeton`;

  // Kilitli rozetler
  if (!slotAyar.vip_aktif) document.getElementById('vip-kilitli').style.display = 'inline';
  if (!slotAyar.plus_aktif) document.getElementById('plus-kilitli').style.display = 'inline';

  // Aktif bahis güncelle
  const fiyat = slotAyar[`${aktifTip}_fiyat`];
  document.getElementById('aktif-bahis-goster').textContent = fiyat;
}

// ─── ÖDEME TABLOSU ───
function odemeTablosunuDoldur() {
  const grid = document.getElementById('odeme-grid');
  if (!grid || !slotAyar) return;

  const tipler = [
    { tip: 'normal', isim: '🎮 Normal', renk: '#f0b429' },
    { tip: 'vip',    isim: '👑 VIP',    renk: '#a78bfa' },
    { tip: 'plus',   isim: '🚀 Plus+',  renk: '#38bdf8' }
  ];

  grid.innerHTML = tipler.map(t => `
    <div class="odeme-kart" style="--tip-renk:${t.renk}">
      <div class="odeme-kart-baslik">${t.isim}</div>
      <div class="odeme-satir">
        <span>Bahis</span>
        <strong>${slotAyar[`${t.tip}_fiyat`]} Jeton</strong>
      </div>
      <div class="odeme-satir">
        <span>Kazanma Şansı</span>
        <strong>%${slotAyar[`${t.tip}_kazanma_orani`]}</strong>
      </div>
      <div class="odeme-satir">
        <span>Max Çarpan</span>
        <strong>${slotAyar[`${t.tip}_carpan_max`]}x</strong>
      </div>
      <div class="odeme-satir odeme-jackpot">
        <span>Jackpot</span>
        <strong>${Math.round(slotAyar[`${t.tip}_fiyat`] * slotAyar[`${t.tip}_carpan_max`])} Jeton</strong>
      </div>
    </div>
  `).join('');
}

// ─── SLOT ÇEVİR ───
async function slotCevir() {
  if (ceviriyor) return;
  if (!kullanici) { window.location.href = '/giris'; return; }

  const fiyat = slotAyar ? slotAyar[`${aktifTip}_fiyat`] : 50;
  if (kullanici.jeton < fiyat) {
    toast(`Yetersiz jeton! Gerekli: ${fiyat}`, false);
    return;
  }

  ceviriyor = true;
  const btn = document.getElementById('slot-cevir-btn');
  btn.disabled = true;
  document.getElementById('slot-btn-icerik').textContent = '⏳ ÇEVİRİYOR...';

  // Optimistik jeton düşme
  kullanici.jeton -= fiyat;
  document.getElementById('jeton-miktar').textContent = kullanici.jeton.toLocaleString('tr-TR');

  // Animasyonu başlat
  animasyonBaslat();

  try {
    const r = await fetch('/api/slot/cevir', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tip: aktifTip })
    });
    const d = await r.json();

    if (!d.basari) {
      animasyonDurdur(['❌','❌','❌']);
      toast(d.mesaj, false);
      kullanici.jeton += fiyat; // geri al
      document.getElementById('jeton-miktar').textContent = kullanici.jeton.toLocaleString('tr-TR');
      ceviriyor = false;
      btn.disabled = false;
      document.getElementById('slot-btn-icerik').textContent = '🎰 ÇEVİR';
      return;
    }

    // Animasyonu sonuç sembollerle durdur
    setTimeout(() => {
      animasyonDurdur(d.semboller, () => {
        // Sonuç göster
        kullanici.jeton = d.yeniJeton;
        document.getElementById('jeton-miktar').textContent = d.yeniJeton.toLocaleString('tr-TR');

        const net = d.net;
        const sonEl = document.getElementById('son-kazanc-goster');
        if (net > 0) {
          sonEl.textContent = `+${net.toLocaleString('tr-TR')}`;
          sonEl.style.color = 'var(--green)';
          kazanOverlay(d.semboller, net, d.carpan);
          kazanEfekti();
        } else if (net < 0) {
          sonEl.textContent = net.toLocaleString('tr-TR');
          sonEl.style.color = 'var(--red)';
          kayipEfekti();
        } else {
          sonEl.textContent = '±0';
          sonEl.style.color = 'var(--t2)';
        }

        ceviriyor = false;
        btn.disabled = false;
        document.getElementById('slot-btn-icerik').textContent = '🎰 ÇEVİR';
      });
    }, 1800); // sunucu cevabını bekle, sonra durdur

  } catch(e) {
    animasyonDurdur(['⚠️','⚠️','⚠️']);
    toast('Bağlantı hatası!', false);
    kullanici.jeton += fiyat;
    document.getElementById('jeton-miktar').textContent = kullanici.jeton.toLocaleString('tr-TR');
    ceviriyor = false;
    btn.disabled = false;
    document.getElementById('slot-btn-icerik').textContent = '🎰 ÇEVİR';
  }
}

// ─── ANİMASYON ───
let animTimers = [];

function animasyonBaslat() {
  const semboller = SEMBOLLER[aktifTip] || SEMBOLLER.normal;

  for (let i = 0; i < 3; i++) {
    const track = document.getElementById(`track-${i}`);
    if (!track) continue;
    track.classList.add('slot-donuyor');
  }

  // Sürekli sembol değiştir (görsel etki)
  for (let i = 0; i < 3; i++) {
    const t = setInterval(() => {
      const track = document.getElementById(`track-${i}`);
      if (!track) return;
      // Track'i yeniden doldur
      let html = '';
      for (let j = 0; j < 20; j++) {
        const s = semboller[Math.floor(Math.random() * semboller.length)];
        html += `<div class="slot-sembol">${s}</div>`;
      }
      track.innerHTML = html;
    }, 80 + i * 30);
    animTimers.push(t);
  }
}

function animasyonDurdur(sonucSemboller, callback) {
  // Timer'ları temizle
  animTimers.forEach(t => clearInterval(t));
  animTimers = [];

  // Makaraları sırayla durdur (cascade)
  for (let i = 0; i < 3; i++) {
    setTimeout(() => {
      const track = document.getElementById(`track-${i}`);
      if (!track) return;
      track.classList.remove('slot-donuyor');
      track.classList.add('slot-durdu');

      // Merkez hücreye sonuç sembolünü koy
      track.innerHTML = `
        <div class="slot-sembol slot-sembol-hayalet">${sonucSemboller[i]}</div>
        <div class="slot-sembol slot-sembol-aktif" id="sonuc-${i}">${sonucSemboller[i]}</div>
        <div class="slot-sembol slot-sembol-hayalet">${sonucSemboller[i]}</div>
      `;

      setTimeout(() => track.classList.remove('slot-durdu'), 400);

      // Son makarada callback
      if (i === 2 && callback) {
        setTimeout(callback, 300);
      }
    }, i * 350);
  }
}

// ─── EFEKTLER ───
function kazanEfekti() {
  const makine = document.getElementById('slot-makine');
  makine.classList.add('slot-kazan-efekt');
  setTimeout(() => makine.classList.remove('slot-kazan-efekt'), 1000);

  // Kazanan çizgiyi göster
  const cizgi = document.getElementById('slot-kazan-cizgi');
  if (cizgi) {
    cizgi.classList.add('slot-cizgi-aktif');
    setTimeout(() => cizgi.classList.remove('slot-cizgi-aktif'), 1500);
  }
}

function kayipEfekti() {
  const makine = document.getElementById('slot-makine');
  makine.classList.add('slot-kayip-efekt');
  setTimeout(() => makine.classList.remove('slot-kayip-efekt'), 500);
}

function kazanOverlay(semboller, net, carpan) {
  const overlay = document.getElementById('slot-overlay');
  document.getElementById('slot-overlay-emoji').textContent = semboller.join('');
  document.getElementById('slot-overlay-baslik').textContent = carpan >= 5 ? '🎉 BÜYÜK KAZANÇ!' : '✨ KAZANDIN!';
  document.getElementById('slot-overlay-miktar').textContent = `+${net.toLocaleString('tr-TR')}`;
  document.getElementById('slot-overlay-alt').textContent = `${carpan}x ÇARPAN — JETON`;

  overlay.style.display = 'flex';
  overlay.classList.add('overlay-gir');
  setTimeout(() => {
    overlay.classList.remove('overlay-gir');
    overlay.style.display = 'none';
  }, 2200);
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
