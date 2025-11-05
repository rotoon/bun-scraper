# Railway Deployment Guide

## 📋 คำอธิบาย

คู่มือการ deploy โปรเจค bun-scraper ไปยัง Railway platform

## 🚀 ขั้นตอนการ Deploy

### 1. เตรียมโปรเจค

✅ ไฟล์ที่จำเป็นพร้อมแล้ว:
- `railway.json` - Config สำหรับ Railway
- `Dockerfile` - สำหรับ container build
- `.env.example` - Environment variables template

### 2. สร้าง Railway Account

1. ไปที่ [railway.app](https://railway.app)
2. Login ด้วย GitHub/GitLab account
3. Install Railway CLI (optional):
```bash
npm install -g @railway/cli
railway login
```

### 3. วิธีที่ 1: Deploy ผ่าน GitHub (แนะนำ)

#### 3.1 Push โค้ดไป GitHub

```bash
git add .
git commit -m "Add Railway deployment files"
git push origin main
```

#### 3.2 Deploy บน Railway

1. ไปที่ Railway dashboard
2. คลิก **New Project**
3. เลือก **Deploy from GitHub repo**
4. เลือก repository ของคุณ
5. Railway จะ detect โปรเจคอัตโนมัติ

### 4. วิธีที่ 2: Deploy ผ่าน Railway CLI

```bash
# เริ่ม project ใหม่
railway new

# หรือ deploy จาก repo ปัจจุบัน
railway up
```

### 5. ตั้งค่า Environment Variables

ใน Railway dashboard ไปที่ Settings → Variables เพิ่ม:

```bash
NODE_ENV=production
PORT=3000
RATE_LIMIT_REQUESTS=100
RATE_LIMIT_WINDOW=60000
SCRAPE_INTERVAL_MINUTES=15
MAX_RETRIES=3
REQUEST_TIMEOUT=30000
LOG_LEVEL=info
```

### 6. Configure Health Check

Railway จะใช้ endpoint ที่เรามีอยู่แล้ว:
- **Health URL:** `/health`
- **Port:** `3000`

### 7. Setup Cron Job (สำหรับ scraping)

1. ใน Railway dashboard ไปที่ Settings → Crons
2. Add cron job:
   - **Path:** `/cron`
   - **Schedule:** `*/15 * * * *` (ทุก 15 นาที)

## 🔧 Configuration Options

### Railway.json อธิบาย

```json
{
  "build": {
    "builder": "NIXPACKS"    // ใช้ Nixpacks สำหรับ Bun
  },
  "deploy": {
    "startCommand": "bun index.ts",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | `production` | Environment mode |
| `PORT` | `3000` | Server port |
| `RATE_LIMIT_REQUESTS` | `100` | Rate limit ต่อ IP |
| `RATE_LIMIT_WINDOW` | `60000` | Window time (ms) |
| `SCRAPE_INTERVAL_MINUTES` | `15` | ช่วงเวลา scraping |
| `MAX_RETRIES` | `3` |จำนวน retry สูงสุด |
| `REQUEST_TIMEOUT` | `30000` | Timeout (ms) |
| `LOG_LEVEL` | `info` | Logging level |

## 🚨 Troubleshooting

### Common Issues

#### 1. Build ล้มเหลว
```bash
# ตรวจสอสิ package.json
cat package.json

# ตรวจสอบ TypeScript
bun tsc --noEmit
```

#### 2. Runtime Error
- ตรวจสอบ logs ใน Railway dashboard
- ตรวจสอบ environment variables
- ตรวจสอบ port configuration

#### 3. Database ไม่ทำงาน
- เช็คว่า database file permissions ถูกต้อง
- ใช้ Railway volume storage ถ้าต้องการ persistence

### Monitoring

- **Logs:** Railway dashboard → Logs tab
- **Metrics:** Railway dashboard → Metrics tab
- **Health:** Automatic health check ที่ `/health`

## 📊 Pricing & Resources

### Railway Free Tier
- **Hours:** 500 hours/month
- **RAM:** 512MB
- **CPU:** Shared
- **Storage:** 1GB

### เหมาะสำหรับ:
- ✅ Development/Staging
- ✅ Small production apps
- ✅ Personal projects

### Upgrade เมื่อ:
- Traffic สูงขึ้น
- ต้องการเพิ่ม resources
- Production จริงจัง

## 🎯 Best Practices

### 1. Security
- ✅ ไม่ commit `.env` ไฟล์
- ✅ ใช้ Railway variables สำหรับ secrets
- ✅ Enable Railway's security features

### 2. Performance
- ✅ Monitor resource usage
- ✅ Optimize database queries
- ✅ Use caching เมื่อจำเป็น

### 3. Reliability
- ✅ Set up proper health checks
- ✅ Configure restart policies
- ✅ Monitor error rates

## 🔄 CI/CD Integration

### Automatic Deployment
```yaml
# .github/workflows/deploy.yml (ถ้าต้องการ)
name: Deploy to Railway
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: railway-app/railway-action@v1
```

## 📞 Support

- **Railway Docs:** https://docs.railway.app
- **Status:** https://status.railway.app
- **Discord:** https://discord.gg/railway

---

**🎉 หลัง deploy เสร็จ API จะพร้อมใช้งานที่:**
`https://your-app-name.up.railway.app`