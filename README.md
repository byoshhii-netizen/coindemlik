# DEM COIN — Layer 1 Blockchain

Sıfırdan Go ile yazılmış, güvenli, siberpunk arayüzlü Layer 1 blockchain.

## ⚡ Hızlı Başlangıç (Lokal)

### Gereklilikler
- Go 1.21+
- PostgreSQL 14+

### Kurulum

```bash
# Bağımlılıkları indir
go mod tidy

# PostgreSQL veritabanını oluştur
createdb demcoin

# Environment değişkenlerini ayarla
cp .env.example .env
# .env dosyasını düzenle

# Sunucuyu başlat
go run .
```

Tarayıcıdan aç: **http://localhost:8080**

## 🚀 Railway'ye Deploy

### 1. Depo Klonla ve İt
```bash
git clone <repo>
git push origin main
```

### 2. Railway Bağla
- [railway.app](https://railway.app) gir
- Yeni Proje oluştur
- GitHub repository'yi bağla
- Services ekle:
  - **PostgreSQL** (otomatik DATABASE_URL atanır)
  - **Go** (Dockerfile'dan)

### 3. Environment Variables Ayarla
Railway Dashboard → Variables:

```
PORT=8080
DEMCOIN_FOUNDER_KEY=<hex_private_key_64_karakter>
ADMIN_SIFRE=<admin_şifresi>
NODE_ENV=production
LOG_LEVEL=info
```

### 4. Deploy Et
GitHub Push → Railway otomatik build ve deploy eder

Domainin: `https://your-app.railway.app`

## 📊 Güvenlik Mimarisi

| Tehdit | Koruma |
|---|---|
| %51 Saldırısı | Sadece kurucu onaylı validatorlar blok basabilir |
| Sybil Saldırısı | Yabancı düğümlerin ağda söz hakkı yok |
| Race Condition | sync.RWMutex ile cüzdan kilitleme |
| Double Spending | Transfer atomik kilit altında işlenir |
| Spam/Bot | Gas fee sistemi (Chat: 1 DEM, Transfer: 5 DEM) |
| Sahte İmza | ECDSA P-256 imza doğrulama |

## 🎮 Türkçe Yönetim Konsolu

| Komut | Açıklama |
|---|---|
| `AgiKilitle` | Tüm transferleri ve chat'i dondurur |
| `AgiAc` | Ağ kilidini açar |
| `CuzdanYasakla(adres)` | Cüzdanı kara listeye alır, bakiyeyi dondurur |
| `ArzSabitle` | 50.000.000 DEM arzını kalıcı olarak kilitler |
| `TokenBas` | Belirtilen adrese token basar |
| `ValidatorEkle` | Yeni validator onaylar |

## 🔧 Ortam Değişkenleri

| Değişken | Açıklama | Varsayılan |
|---|---|---|
| `PORT` | HTTP sunucusu portu | 8080 |
| `DATABASE_URL` | PostgreSQL bağlantı string | (Railway otomatik) |
| `DEMCOIN_FOUNDER_KEY` | Kurucu özel anahtarı (64 hex) | ❌ GEREKLI |
| `ADMIN_SIFRE` | Yönetim konsolu şifresi | `kazyontuyozazyontuyozgardas` |
| `NODE_ENV` | Ortam türü | `production` |
| `LOG_LEVEL` | Log seviyesi | `info` |

## 🏗️ API Endpoints

### Wallet
- `POST /api/wallet/new` - Yeni cüzdan oluştur
- `POST /api/wallet/import` - Cüzdan içeri aktar
- `GET /api/wallet/:address/balance` - Bakiye sorgula
- `POST /api/transfer` - Token gönder

### Mining
- `GET /api/mining/status` - Mining durumu
- `POST /api/mining/stake` - Stake et
- `POST /api/mining/unstake` - Unstake et

### Admin
- `GET /api/admin/wallets` - Tüm cüzdanlar
- `POST /api/admin/imza-olustur` - İmza oluştur (admin)

### State
- `GET /api/state` - Ağ durumu
- `GET /api/blocks` - Blok listesi
- `GET /api/price/history` - Fiyat geçmişi

## 📝 Lisans

MIT License - Tüm hakları saklıdır.
