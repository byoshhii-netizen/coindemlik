// DemliCoin Admin Panel JS

function adminSekme(sekme, btn) {
  document.querySelectorAll('.admin-panel').forEach(p => p.classList.remove('aktif-panel'));
  document.querySelectorAll('.admin-nav-btn').forEach(b => b.classList.remove('aktif'));
  document.getElementById('admin-' + sekme).classList.add('aktif-panel');
  btn.classList.add('aktif');

  if (sekme === 'oyuncular') yukleOyuncular();
  if (sekme === 'itemlar') yukleItemAyarlari();
  if (sekme === 'paketler') yuklePaketAyarlari();
  if (sekme === 'parakopar') yukleParaKoparAyar();
  if (sekme === 'grafik') yukleGrafikAyarlari();
}

// ─────────────────── GRAFİK ───────────────────
async function yukleGrafikAyarlari() {
  try {
    const r = await fetch('/api/admin/grafik-ayar', { method: 'GET' });
    // Şu an GET endpoint yok, değerleri olduğu gibi bırak
  } catch(e) {}
}

async function grafigKaydet() {
  const body = {
    guncelleme_suresi: parseInt(document.getElementById('g-sure').value),
    min_deger: parseFloat(document.getElementById('g-min').value),
    max_deger: parseFloat(document.getElementById('g-max').value),
    artma_orani: parseFloat(document.getElementById('g-artma').value),
    azalma_orani: parseFloat(1 - document.getElementById('g-artma').value).toFixed(2),
    max_degisim: parseFloat(document.getElementById('g-degisim').value)
  };

  const r = await fetch('/api/admin/grafik-ayar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const d = await r.json();
  adminMesaj('grafik-sonuc', d.mesaj, d.basari);
}

async function manuelGrafik() {
  const siradakiDeger = parseFloat(document.getElementById('g-siradaki').value);
  const siradakiSure = parseInt(document.getElementById('g-siradaki-sure').value) || null;

  if (!siradakiDeger || isNaN(siradakiDeger)) {
    adminMesaj('grafik-sonuc', 'Geçerli bir değer girin!', false);
    return;
  }

  const mevcut = {
    guncelleme_suresi: parseInt(document.getElementById('g-sure').value),
    min_deger: parseFloat(document.getElementById('g-min').value),
    max_deger: parseFloat(document.getElementById('g-max').value),
    artma_orani: parseFloat(document.getElementById('g-artma').value),
    max_degisim: parseFloat(document.getElementById('g-degisim').value),
    siradaki_deger: siradakiDeger,
    siradaki_sure: siradakiSure
  };

  const r = await fetch('/api/admin/grafik-ayar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(mevcut)
  });
  const d = await r.json();
  adminMesaj('grafik-sonuc', `Manuel değer ayarlandı: ${siradakiDeger}`, d.basari);
  document.getElementById('g-siradaki').value = '';
  document.getElementById('g-siradaki-sure').value = '';
}

// ─────────────────── OYUNCULAR ───────────────────
async function yukleOyuncular() {
  const r = await fetch('/api/admin/oyuncular');
  const d = await r.json();
  const tbody = document.getElementById('oyuncu-tablo-body');
  tbody.innerHTML = '';
  d.oyuncular.forEach(k => {
    const tarih = new Date(k.olusturma_tarihi).toLocaleDateString('tr-TR');
    tbody.innerHTML += `
      <tr>
        <td><strong>${k.nick}</strong></td>
        <td>🪙 ${k.jeton.toLocaleString('tr-TR')}</td>
        <td>₺${(k.toplam_yatirilan || 0).toFixed(2)}</td>
        <td>${tarih}</td>
        <td>
          ${k.yasak ? '<span class="etiket etiket-kirmizi">Yasaklı</span>' : '<span class="etiket etiket-yesil">Aktif</span>'}
          ${k.chat_yasak ? '<span class="etiket etiket-sari">Chat Yasak</span>' : ''}
        </td>
        <td class="islem-butonlar">
          ${k.yasak
            ? `<button class="btn btn-kucuk btn-basari" onclick="yasakToggle(${k.id}, false)">✅ Yasağı Kaldır</button>`
            : `<button class="btn btn-kucuk btn-tehlike" onclick="yasakToggle(${k.id}, true)">🚫 Yasakla</button>`
          }
          ${k.chat_yasak
            ? `<button class="btn btn-kucuk btn-uyari" onclick="chatYasakToggle(${k.id}, false)">💬 Chat Yasağını Kaldır</button>`
            : `<button class="btn btn-kucuk btn-uyari" onclick="chatYasakToggle(${k.id}, true)">🔇 Chat Yasağı</button>`
          }
        </td>
      </tr>
    `;
  });
}

async function yasakToggle(id, durum) {
  await fetch('/api/admin/oyuncu-yasak', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ kullanici_id: id, durum })
  });
  yukleOyuncular();
}

async function chatYasakToggle(id, durum) {
  await fetch('/api/admin/chat-yasak', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ kullanici_id: id, durum })
  });
  yukleOyuncular();
}

// ─────────────────── CHAT GEÇMİŞİ ───────────────────
async function yukleChat() {
  const gun = document.getElementById('chat-gun').value;
  const saat = document.getElementById('chat-saat').value;
  let url = '/api/admin/chat-gecmis?';
  if (gun) url += `gun=${gun}&`;
  if (saat !== '') url += `saat=${saat}`;

  const r = await fetch(url);
  const d = await r.json();
  const liste = document.getElementById('chat-gecmis-liste');
  liste.innerHTML = '';

  if (d.mesajlar.length === 0) {
    liste.innerHTML = '<p style="color:#aaa;text-align:center;">Mesaj bulunamadı.</p>';
    return;
  }

  d.mesajlar.forEach(m => {
    const tarih = new Date(m.tarih).toLocaleString('tr-TR');
    liste.innerHTML += `
      <div class="chat-gecmis-satir">
        <span class="cg-zaman">${tarih}</span>
        <span class="cg-nick">${m.nick || 'Bilinmeyen'}</span>
        <span class="cg-mesaj">${escapeHtml(m.mesaj)}</span>
      </div>
    `;
  });
}

// ─────────────────── İTEM AYARLARI ───────────────────
async function yukleItemAyarlari() {
  const r = await fetch('/api/admin/itemlar');
  const d = await r.json();
  const liste = document.getElementById('item-ayar-listesi');
  liste.innerHTML = '';

  d.itemlar.forEach(item => {
    liste.innerHTML += `
      <div class="admin-kart" id="item-kart-${item.id}">
        <h3>${item.isim}</h3>
        <div class="form-grup">
          <label>İsim</label>
          <input type="text" id="item-isim-${item.id}" value="${item.isim}" />
        </div>
        <div class="form-grup">
          <label>Açıklama</label>
          <textarea id="item-aciklama-${item.id}" rows="2">${item.aciklama}</textarea>
        </div>
        <div class="form-grup">
          <label>Fiyat</label>
          <input type="number" id="item-fiyat-${item.id}" value="${item.fiyat}" min="0" />
        </div>
        <div class="form-grup">
          <label>Para Birimi</label>
          <select id="item-para-${item.id}">
            <option value="jeton" ${item.para_birimi === 'jeton' ? 'selected' : ''}>🪙 Jeton</option>
            <option value="tl" ${item.para_birimi === 'tl' ? 'selected' : ''}>₺ TL</option>
            <option value="dolar" ${item.para_birimi === 'dolar' ? 'selected' : ''}>$ Dolar</option>
          </select>
        </div>
        <div class="form-grup">
          <label>Kullanım Hakkı</label>
          <input type="number" id="item-kullanim-${item.id}" value="${item.kullanim_hakki}" min="1" />
        </div>
        <div class="form-grup">
          <label>Durum</label>
          <select id="item-aktif-${item.id}">
            <option value="1" ${item.aktif ? 'selected' : ''}>✅ Aktif</option>
            <option value="0" ${!item.aktif ? 'selected' : ''}>❌ Pasif</option>
          </select>
        </div>
        <button class="btn btn-ana" onclick="itemGuncelle(${item.id})">💾 Kaydet</button>
        <div id="item-mesaj-${item.id}" class="admin-mesaj" style="display:none;"></div>
      </div>
    `;
  });
}

async function itemGuncelle(id) {
  const body = {
    id,
    isim: document.getElementById(`item-isim-${id}`).value,
    aciklama: document.getElementById(`item-aciklama-${id}`).value,
    fiyat: parseFloat(document.getElementById(`item-fiyat-${id}`).value),
    para_birimi: document.getElementById(`item-para-${id}`).value,
    kullanim_hakki: parseInt(document.getElementById(`item-kullanim-${id}`).value),
    aktif: document.getElementById(`item-aktif-${id}`).value === '1'
  };

  const r = await fetch('/api/admin/item-guncelle', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const d = await r.json();
  adminMesaj(`item-mesaj-${id}`, d.basari ? 'Kaydedildi!' : 'Hata!', d.basari);
}

// ─────────────────── PAKET AYARLARI ───────────────────
async function yuklePaketAyarlari() {
  const r = await fetch('/api/admin/jeton-paketleri');
  const d = await r.json();
  const liste = document.getElementById('paket-ayar-listesi');
  liste.innerHTML = '';

  d.paketler.forEach(paket => {
    liste.innerHTML += `
      <div class="admin-kart">
        <h3>${paket.isim} — 🪙 ${paket.jeton_miktari.toLocaleString('tr-TR')}</h3>
        <div class="form-grup">
          <label>Fiyat</label>
          <input type="number" id="paket-fiyat-${paket.id}" value="${paket.fiyat}" min="0" step="0.01" />
        </div>
        <div class="form-grup">
          <label>Para Birimi</label>
          <select id="paket-para-${paket.id}">
            <option value="tl" ${paket.para_birimi === 'tl' ? 'selected' : ''}>₺ TL</option>
            <option value="dolar" ${paket.para_birimi === 'dolar' ? 'selected' : ''}>$ Dolar</option>
          </select>
        </div>
        <div class="form-grup">
          <label>Durum</label>
          <select id="paket-aktif-${paket.id}">
            <option value="1" ${paket.aktif ? 'selected' : ''}>✅ Aktif</option>
            <option value="0" ${!paket.aktif ? 'selected' : ''}>❌ Pasif</option>
          </select>
        </div>
        <button class="btn btn-ana" onclick="paketGuncelle(${paket.id})">💾 Kaydet</button>
        <div id="paket-mesaj-${paket.id}" class="admin-mesaj" style="display:none;"></div>
      </div>
    `;
  });
}

async function paketGuncelle(id) {
  const body = {
    id,
    fiyat: parseFloat(document.getElementById(`paket-fiyat-${id}`).value),
    para_birimi: document.getElementById(`paket-para-${id}`).value,
    aktif: document.getElementById(`paket-aktif-${id}`).value === '1'
  };

  const r = await fetch('/api/admin/paket-guncelle', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const d = await r.json();
  adminMesaj(`paket-mesaj-${id}`, d.basari ? 'Kaydedildi!' : 'Hata!', d.basari);
}

// ─────────────────── PARA KOPAR ───────────────────
async function yukleParaKoparAyar() {
  const r = await fetch('/api/admin/para-kopar-ayar');
  const d = await r.json();
  if (d.basari) {
    document.getElementById('pk-min').value = d.ayar.min_miktar;
    document.getElementById('pk-max').value = d.ayar.max_miktar;
  }
}

async function koparKaydet() {
  const body = {
    min_miktar: parseInt(document.getElementById('pk-min').value),
    max_miktar: parseInt(document.getElementById('pk-max').value)
  };
  const r = await fetch('/api/admin/para-kopar-ayar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const d = await r.json();
  adminMesaj('kopar-mesaj', d.basari ? 'Kaydedildi!' : 'Hata!', d.basari);
}

// ─────────────────── YARDIMCI ───────────────────
function adminMesaj(elId, mesaj, basari) {
  const el = document.getElementById(elId);
  if (!el) return;
  el.textContent = mesaj;
  el.className = `admin-mesaj ${basari ? 'mesaj-basari' : 'mesaj-hata'}`;
  el.style.display = 'block';
  setTimeout(() => el.style.display = 'none', 3000);
}

function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function adminCikis() {
  await fetch('/api/admin/cikis', { method: 'POST' });
  window.location.href = '/yonetbunlari/giris';
}

// İlk yükleme
yukleGrafikAyarlari();
