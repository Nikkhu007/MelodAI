# 🎵 How to Share MelodAI with Friends

Three ways — pick the one that fits your situation.

---

## ✅ Option 1 — Same WiFi / Hostel Network (Zero Cost)
> Friends on the same network access it from their phone/laptop

### Setup (1 min)
1. Run `python run.py` normally
2. Open cmd and find your laptop's IP:
   ```
   ipconfig
   ```
   Look for **IPv4 Address** under your WiFi adapter — something like `192.168.1.105`

3. Tell your friends to open:
   ```
   http://192.168.1.105:5173
   ```
   That's it! They can use it from phone or laptop.

### Limits
- Your laptop must be ON and running `python run.py`
- Only works on same WiFi (hostel, college)
- YouTube works (runs on your machine)

---

## ✅ Option 2 — Internet Access with ngrok (Free, Any Device Anywhere)
> Anyone in the world can access it with a link. Free forever.

### One-time setup
1. Go to https://ngrok.com → Sign up free → Download ngrok
2. Run your app: `python run.py`
3. Open a second cmd window:
   ```
   ngrok http 5173
   ```
4. ngrok gives you a URL like:
   ```
   https://abc123.ngrok-free.app
   ```
5. Share that URL with anyone — works on phone, laptop, anywhere!

### Limits
- Your laptop must be ON
- Free ngrok URL changes every time you restart ngrok
- ngrok free tier has a 40 connections/min limit (fine for small group)

---

## ✅ Option 3 — Deploy Properly (Always Online, No Laptop Needed)
> Runs 24/7 on cloud servers. Friends access anytime even when your laptop is off.

### Architecture
```
Frontend  →  Vercel      (free)
Backend   →  Render      (free)
Database  →  MongoDB Atlas (already have this)
```

### Step 1 — Push to GitHub
```bash
cd melodai
git init
git add .
git commit -m "MelodAI v1"
```
Go to github.com → New repository → name it `melodai` → copy the remote URL
```bash
git remote add origin https://github.com/YOUR_USERNAME/melodai.git
git push -u origin main
```

### Step 2 — Deploy Backend on Render (free)
1. Go to https://render.com → Sign up with GitHub
2. Click **New** → **Web Service**
3. Connect your `melodai` repo
4. Settings:
   - **Root Directory**: `backend`
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
   - **Instance Type**: Free
5. Add these **Environment Variables**:
   ```
   NODE_ENV=production
   MONGODB_URI=your_atlas_uri
   JWT_SECRET=any_long_random_string
   JWT_EXPIRE=30d
   CLOUDINARY_CLOUD_NAME=your_name
   CLOUDINARY_API_KEY=your_key
   CLOUDINARY_API_SECRET=your_secret
   CLIENT_URL=https://your-app.vercel.app
   ```
6. Click **Deploy** — takes ~3 min
7. Copy your Render URL: `https://melodai-backend.onrender.com`

### Step 3 — Deploy Frontend on Vercel (free)
1. Go to https://vercel.com → Sign up with GitHub
2. Click **Add New** → **Project**
3. Import your `melodai` repo
4. Settings:
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
5. Add **Environment Variables**:
   ```
   VITE_API_URL=https://melodai-backend.onrender.com/api
   VITE_JAMENDO_CLIENT_ID=b6747d04
   ```
6. Click **Deploy** — takes ~2 min
7. Copy your Vercel URL: `https://melodai.vercel.app`

### Step 4 — Update Render with Vercel URL
Go back to Render → Environment → Update:
```
CLIENT_URL=https://melodai.vercel.app
```
Redeploy.

### Step 5 — Tell your friends!
Share: `https://melodai.vercel.app` — works forever, on any device, anywhere

### Note about YouTube on deployed version
YouTube streaming uses yt-dlp which needs a server with access to YouTube.
Render's free servers are sometimes blocked by YouTube.
- Songs from **Jamendo** (free music) still work perfectly on Render
- For YouTube on production, you'd need a paid server (not needed for friends)
- Localhost version always has YouTube working

---

## Quick Comparison

| Feature | Same WiFi | ngrok | Vercel + Render |
|---------|-----------|-------|-----------------|
| Cost | Free | Free | Free |
| Setup time | 2 min | 5 min | 30 min |
| Works 24/7 | ❌ (laptop on) | ❌ (laptop on) | ✅ |
| YouTube | ✅ | ✅ | ⚠️ (may be blocked) |
| Any device | ❌ (same WiFi) | ✅ | ✅ |
| Custom domain | ❌ | ❌ | ✅ (free .vercel.app) |

---

## Recommended for you (hostel situation)
**Start with Option 1** (same WiFi) — takes 2 minutes.
If your friends aren't on the same WiFi, use **Option 2** (ngrok).
When you want it always online, do **Option 3** (Vercel + Render).
