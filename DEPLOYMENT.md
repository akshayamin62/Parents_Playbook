# Deployment guide — Shared hosting + VPS

**Repository:** [github.com/akshayamin62/Parents_Playbook](https://github.com/akshayamin62/Parents_Playbook)

This project runs in two places:

1. **Frontend** on Hostinger **shared** → [http://kareerstudio.com/mydreams/](http://kareerstudio.com/mydreams/)
2. **Backend** on Hostinger **VPS** → e.g. `https://api.kareerstudio.com` (Node listens on **port `5017`**)

---

## Overview diagram

```
[Visitor browser]
       │
       ▼
kareerstudio.com/mydreams/         (static HTML, shared hosting)
       │
       │  fetch POST /free-preview, POST /enquiry  (HTTPS API + CORS)
       ▼
api.kareerstudio.com               (Nginx → Node :5017, VPS)
       │
       ├── SMTP (Gmail App Password)
       ├── Email PDF to user
       └── Notify team (NOTIFY_EMAIL)
```

---

## Prerequisites

- Domain DNS managed in Hostinger (or your registrar pointed to Hostinger).
- **Shared hosting** account with File Manager or FTP for `kareerstudio.com`.
- **VPS** with Ubuntu (or similar), root/sudo; ports **80/443** (Nginx) and **5017** (Node, local only).
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

### A2. Clone from GitHub

SSH into the VPS, then:

```bash
cd ~
git clone https://github.com/akshayamin62/Parents_Playbook.git
cd Parents_Playbook/backend
```

**Do not** commit or push `backend/.env` — create it only on the server.

Install dependencies:

```bash
npm install --omit=dev
```

### A3. PDF on VPS only

The preview PDF must exist on the VPS (not on shared hosting as a public file):

```bash
cp ../free-preview.pdf ./assets/free-preview.pdf
chmod 644 ./assets/free-preview.pdf
```

### A4. Environment file

```bash
cp .env.example .env
nano .env
```

Example **production** values:

```env
PORT=5017
NODE_ENV=production

# Exact origins the browser sends (no trailing slash). Include http + https, www + non-www.
CORS_ORIGINS=http://kareerstudio.com,http://www.kareerstudio.com,https://kareerstudio.com,https://www.kareerstudio.com

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

From `~/Parents_Playbook/backend`:

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
curl http://127.0.0.1:5017/health
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
        proxy_pass http://127.0.0.1:5017;
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
cd ~/Parents_Playbook
git pull origin main
cd backend
npm install --omit=dev
pm2 restart playbook-api
```

---

## Part B — Frontend on shared hosting

### B1. Folder on server

In Hostinger **File Manager** (or FTP), open the site root (often `public_html`) and use:

```
public_html/mydreams/
```

Live URL: [http://kareerstudio.com/mydreams/](http://kareerstudio.com/mydreams/)

### B2. Files to upload

From your clone (or download from GitHub), upload **only**:

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

Production uses the API subdomain when **not** on localhost:

```js
const PLAYBOOK_API_BASE =
  location.hostname === "localhost" || location.hostname === "127.0.0.1"
    ? "http://localhost:3847"
    : "https://api.kareerstudio.com";
```

An **HTTP** landing page calling an **HTTPS** API is allowed in browsers. If your API hostname differs, change the production string before uploading.

### B4. Verify in browser

1. Open [http://kareerstudio.com/mydreams/](http://kareerstudio.com/mydreams/)
2. Submit **free preview** form (use your real email).
3. Submit **enquiry** from “Three ways to begin”.
4. Check inbox + `NOTIFY_EMAIL`.

If the form fails with CORS or network errors, confirm `CORS_ORIGINS` on the VPS includes  
`http://kareerstudio.com` (and other variants above), then `pm2 restart playbook-api`.

---

## Part C — Post-deploy checklist

| Check | Action |
|-------|--------|
| API health | `curl https://api.kareerstudio.com/health` → `{"ok":true}` |
| Node port | `curl http://127.0.0.1:5017/health` on VPS |
| SMTP | `npm run verify-smtp` in `backend/` |
| CORS | `CORS_ORIGINS` lists all live site origins (no trailing slash) |
| PDF | `~/Parents_Playbook/backend/assets/free-preview.pdf` on VPS only |
| Public PDF | Not under `public_html/mydreams/` on shared hosting |
| SSL | API at `https://api.kareerstudio.com` |
| PM2 | `pm2 status` shows `online` after reboot |
| Firewall | Port **5017** only on localhost (Nginx public); do not expose 5017 to the internet unless intended |

---

## Troubleshooting

### `Email could not be sent (server mail login failed)`

- Use a **Google App Password** on the **same** account as `SMTP_USER`.
- `MAIL_FROM` must use that same address.
- Run `npm run verify-smtp` on the VPS.

### `Origin not allowed` / CORS

- Add the exact origin from DevTools → Network (e.g. `http://kareerstudio.com`).
- Include `http://` and `https://`, with and without `www`.
- Restart PM2 after editing `.env`.

### Preview error: PDF missing

```bash
cp ~/Parents_Playbook/free-preview.pdf ~/Parents_Playbook/backend/assets/free-preview.pdf
```

### Form works locally but not in production

- Confirm `api.kareerstudio.com` resolves to the VPS.
- Confirm Nginx `proxy_pass` points to **5017** and `PORT=5017` in `.env`.
- Check `pm2 logs playbook-api` for errors.

---

## GitHub workflow

1. Develop locally; push to [Parents_Playbook](https://github.com/akshayamin62/Parents_Playbook) (`.env` stays gitignored).
2. On VPS: `git pull` under `~/Parents_Playbook`, then `pm2 restart playbook-api` from `backend/`.
3. On shared hosting: upload changed static files when `index.html` or assets change.

For local development, see [README.md](./README.md).