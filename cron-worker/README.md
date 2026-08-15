# ⏱️ DELTA Keep-Alive Cloudflare Worker (13-Minute Cron)

This Cloudflare Worker runs a Cron Trigger on Cloudflare's Edge network every **13 minutes** (`*/13 * * * *`) to ping the DELTA Go Web Service on Render (`https://antigravity-ui-cx0g.onrender.com/api/health`).

This prevents Render's free tier from spinning down due to the 15-minute inactivity timeout.

---

## 🚀 Quick Deployment

### 1. Authenticate with Cloudflare
```bash
cd cron-worker
npx wrangler login
```

### 2. Deploy the Worker
```bash
npx wrangler deploy
```

### 3. Test the Cron Trigger Locally
```bash
npx wrangler dev --test-scheduled
# Trigger the cron test in a separate terminal:
curl "http://localhost:8787/__scheduled?cron=*/13+*+*+*+*"
```

---

## ⚙️ Configuration (`wrangler.jsonc`)

```jsonc
{
  "name": "delta-keepalive-worker",
  "main": "src/index.ts",
  "compatibility_date": "2026-02-01",
  "triggers": {
    "crons": ["*/13 * * * *"]
  },
  "vars": {
    "TARGET_URL": "https://antigravity-ui-cx0g.onrender.com/api/health"
  }
}
```
