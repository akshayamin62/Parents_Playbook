# Deployment guide — Shared hosting + VPS

This project runs in two places:

1. **Frontend** on Hostinger **shared** → `https://www.kareerstudio.com/mydreams/`
2. **Backend** on Hostinger **VPS** → e.g. `https://api.kareerstudio.com`

---

## Overview diagram

```
[Visitor browser]
       │
       ▼
www.kareerstudio.com/mydreams/     (static HTML, shared hosting)
       │
       │  fetch POST /free-preview, POST /enquiry  (HTTPS + CORS)
       ▼
api.kareerstudio.com               (Nginx → Node :3847, VPS)
       │
       ├── SMTP (Gmail App Password)
       ├── Email PDF to user
       └── Notify team (NOTIFY_EMAIL)
```

---

## Prerequisites

- Domain DNS managed in Hostinger (or your registrar pointed to Hostinger).
- **Shared hosting** account with File Manager or FTP for `kareerstudio.com`.
- **VPS** with Ubuntu (or similar), root/sudo, ports 80/443 open.
- Gmail account for sending (e.g. `kareerstudio@gmail.com`) with **2-Step Verification** and an **App Password**.
- SSL on the API subdomain (Let’s Encrypt via Certbot).

---

## Part A — Backend on VPS

### A1. DNS

In Hostinger → **DNS**:

| Type | Name | Points to |
|------|------|-----------|
| A | `api` | Your VPS public IPv4 |

Wait for propagation (minutes to a few hours).

### A2. Upload code on the VPS

SSH into the VPS, then:

```bash
sudo mkdir -p /var/www/parents-playbook-api
sudo chown $USER:$USER /var/www/parents-playbook-api
cd /var/www/parents-playbook-api
```

Upload the `backend/` folder contents here (Git clone, `scp`, or SFTP). **Do not** upload `node_modules` or `.env`.

```bash
git clone <your-github-repo-url> /tmp/playbook
cp -r /tmp/playbook/backend/* /var/www/parents-playbook-api/
```

Install dependencies:

```bash
cd /var/www/parents-playbook-api
npm install --omit=dev
```

### A3. PDF on VPS only

The preview PDF must exist on the VPS (not on shared hosting as a public file):

```bash
cp /path/to/free-preview.pdf ./assets/free-preview.pdf
chmod 644 ./assets/free-preview.pdf
```

### A4. Environment file

```bash
cp .env.example .env
nano .env
```

Example production values:

```env
PORT=3847
NODE_ENV=production

CORS_ORIGINS=https://www.kareerstudio.com,https://kareerstudio.com

SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=kareerstudio@gmail.com
SMTP_PASS=your-16-char-app-password

MAIL_FROM="Kareer Studio <kareerstudio@gmail.com>"
NOTIFY_EMAIL=hello@kareerstudio.com
CONTACT_EMAIL=hello@kareerstudio.com

PDF_PATH=./assets/free-preview.pdf
```

Verify SMTP before going live:

```bash
npm run verify-smtp
```

### A5. Run with PM2

```bash
sudo npm install -g pm2
pm2 start server.js --name playbook-api
pm2 save
pm2 startup
# Run the command PM2 prints, then:
pm2 save
```

Check logs:

```bash
pm2 logs playbook-api
curl http://127.0.0.1:3847/health
```

### A6. Nginx reverse proxy

```bash
sudo apt update
sudo apt install -y nginx certbot python3-certbot-nginx
```

Create `/etc/nginx/sites-available/api.kareerstudio.com`:

```nginx
server {
    listen 80;
    server_name api.kareerstudio.com;

    location / {
        proxy_pass http://127.0.0.1:3847;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable and obtain SSL:

```bash
sudo ln -s /etc/nginx/sites-available/api.kareerstudio.com /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
sudo certbot --nginx -d api.kareerstudio.com
```

Test publicly:

```bash
curl https://api.kareerstudio.com/health
```

### A7. Updates (redeploy API)

```bash
cd /var/www/parents-playbook-api
git pull   # or re-upload changed files
npm install --omit=dev
pm2 restart playbook-api
```

---

## Part B — Frontend on shared hosting

### B1. Folder on server

In Hostinger **File Manager** (or FTP), open the site root (often `public_html`) and create:

```
public_html/mydreams/
```

This maps to `https://www.kareerstudio.com/mydreams/`.

### B2. Files to upload

Upload **only**:

| File | Required |
|------|----------|
| `index.html` | Yes |
| `author.webp` | Yes |
| `book-cover.png` | Yes |
| `.htaccess` | Recommended |

**Do not upload** `free-preview.pdf` to `mydreams/` if you want email-only access.

Optional: rename `mydreams.htaccess.example` → `.htaccess` and upload to block accidental PDF access:

```apache
<Files "free-preview.pdf">
  Require all denied
</Files>
```

### B3. API URL in `index.html`

Production uses the API subdomain automatically when **not** on localhost:

```js
const PLAYBOOK_API_BASE =
  location.hostname === "localhost" || location.hostname === "127.0.0.1"
    ? "http://localhost:3847"
    : "https://api.kareerstudio.com";
```

If your API hostname differs, change the production string before uploading.

### B4. Verify in browser

1. Open `https://www.kareerstudio.com/mydreams/`
2. Submit **free preview** form (use your real email).
3. Submit **enquiry** from “Three ways to begin”.
4. Check inbox + `NOTIFY_EMAIL`.

If the form fails with CORS or network errors, confirm `CORS_ORIGINS` on the VPS includes  
`https://www.kareerstudio.com` and restart PM2.

---

## Part C — Post-deploy checklist

| Check | Action |
|-------|--------|
| API health | `curl https://api.kareerstudio.com/health` → `{"ok":true}` |
| SMTP | `npm run verify-smtp` on VPS |
| CORS | `CORS_ORIGINS` has exact site origins (no trailing slash) |
| PDF | Present at `backend/assets/free-preview.pdf` on VPS only |
| Public PDF | Not listed under `/mydreams/` on shared hosting |
| SSL | Both `www` and `api` serve HTTPS |
| PM2 | `pm2 status` shows `online` after reboot |

---

## Troubleshooting

### `Email could not be sent (server mail login failed)`

- Use a **Google App Password** on the **same** account as `SMTP_USER`.
- `MAIL_FROM` must use that same address.
- College / Workspace student accounts often block SMTP — use `kareerstudio@gmail.com` for production.
- Run `npm run verify-smtp` on the VPS.

### `Origin not allowed` / CORS

- Add `https://www.kareerstudio.com` to `CORS_ORIGINS`.
- Include `https://kareerstudio.com` if users visit without `www`.
- Restart the API after editing `.env`.

### Preview error: PDF missing

- Copy `free-preview.pdf` to `assets/` on the VPS.
- Check `PDF_PATH` in `.env`.

### Form works locally but not in production

- Confirm `api.kareerstudio.com` resolves to the VPS.
- Check browser DevTools → Network for blocked mixed content (page must be HTTPS; API must be HTTPS).

---

## GitHub workflow (optional)

1. Push this repo to GitHub (`.env` is gitignored).
2. On VPS: `git clone` and pull updates; never commit secrets.
3. On shared hosting: upload changed static files via File Manager/FTP or a deploy script.

For local development, see [README.md](./README.md).