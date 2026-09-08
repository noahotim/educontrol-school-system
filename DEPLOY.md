# Deploy EduControl to GitHub + Render (2 minutes)

## 1. Create GitHub Repo (you must be logged in)
Run in PowerShell from this folder:

```powershell
gh auth login
# choose: GitHub.com → HTTPS → Yes → Paste token OR browser login
gh repo create educontrol-school-system --public --source=. --remote=origin --push
# OR if repo already exists:
# git remote add origin https://github.com/YOUR_USERNAME/educontrol-school-system.git
# git push -u origin master
```

Your repo will be at: `https://github.com/YOUR_USERNAME/educontrol-school-system`

## 2. Deploy to Render (BEST FREE HOST for this system — from your list)
Render is the only free host in your list that runs a full Node.js server + database.
GitHub Pages / Netlify / Vercel / Cloudflare Pages = static-only (cannot run this system).

Steps:
1. Go to https://dashboard.render.com → **New +** → **Web Service**
2. Connect your `educontrol-school-system` GitHub repo
3. Render auto-detects `render.yaml`:
   - Build: `npm install`
   - Start: `npm start`
4. Add Environment Variable: `JWT_SECRET` → Generate (or set any random string)
5. Click **Create Web Service** → live in ~2 min at `https://educontrol-xxxx.onrender.com`
6. Login: `admin / admin123`

> **Persistence note:** Render free uses ephemeral disk (data resets on redeploy). For production:
> - Option A: Upgrade Render and add Disk for `/data` (1GB+)
> - Option B: Switch DB to Neon Postgres (free) — https://neon.tech — set `DATABASE_URL`

## 3. Run Locally
```powershell
npm install
node server/seed.js
npm start
# open http://localhost:3000  admin/admin123
```

## Manual GitHub Push (without gh)
```powershell
git remote add origin https://github.com/YOUR_USERNAME/educontrol-school-system.git
git branch -M main
git push -u origin main
```
