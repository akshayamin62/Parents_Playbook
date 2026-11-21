# Deployment guide — Shared hosting + VPS

**Repository:** [github.com/akshayamin62/Parents_Playbook](https://github.com/akshayamin62/Parents_Playbook)

This project runs in two places:

1. **Frontend** on Hostinger **shared** → [http://kareerstudio.com/mydreams/](http://kareerstudio.com/mydreams/)
2. **Backend** on Hostinger **VPS** → `https://parents-playbook-api.kareerstudio.com` (Node listens on **port `5017`**)

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
parents-playbook-api.kareerstudio.com   (Nginx → Node :5017, VPS)
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

### A1. DNS (Hostinger)

In Hostinger → **Domains** → `kareerstudio.com` → **DNS / DNS Zone**:

| Type | Name | Content / Points to | TTL |
|------|------|---------------------|-----|
| **A** | `parents-playbook-api` | Your **VPS public IPv4** | 14400 (or default) |

That creates **`parents-playbook-api.kareerstudio.com`** → VPS.

> Use **hyphens**, not underscores (`Parents_Playbook-api` is not valid as a hostname; DNS name is `parents-playbook-api`).

Wait a few minutes, then check:

```bash
ping parents-playbook-api.kareerstudio.com
# or: dig +short parents-playbook-api.kareerstudio.com
```

**Important:** Add the record on **`kareerstudio.com`** DNS (Hostinger → **Websites** → domain → **DNS Zone**), **not** on the VPS hostname `srv908191.hstgr.cloud` or similar. Certbot will fail with **NXDOMAIN** until this A record exists.

On the VPS, confirm the same IP and that DNS has propagated **before** running Certbot:

```bash
curl -4 -s ifconfig.me
# Note this IPv4 — it must match the A record in Hostinger.

dig +short parents-playbook-api.kareerstudio.com A
# Must return that VPS IP. If empty or NXDOMAIN, wait or fix DNS; do not run certbot yet.

curl -sI http://parents-playbook-api.kareerstudio.com/health
# From VPS: should get HTTP headers (502/200) once DNS points here — not "Could not resolve host".
```

Wait for propagation (minutes to a few hours, sometimes up to 24h).

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
pm2 start server.js --name parents-playbook-api
pm2 save
pm2 startup
# Run the command PM2 prints, then:
pm2 save
```

Check logs:

```bash
pm2 logs parents-playbook-api
curl http://127.0.0.1:5017/health
```

### A6. Nginx reverse proxy

Install Nginx and Certbot (run once on the VPS):

```bash
sudo apt update
sudo apt install -y nginx certbot python3-certbot-nginx
```

**Create the site config in one step** — SSH into the VPS, copy the whole block below, paste into the terminal, press Enter:

```bash
sudo tee /etc/nginx/sites-available/parents-playbook-api.kareerstudio.com > /dev/null <<'EOF'
server {
    listen 80;
    listen [::]:80;
    server_name parents-playbook-api.kareerstudio.com;

    client_max_body_size 20m;

    location / {
        proxy_pass http://127.0.0.1:5017;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
EOF
```

Enable the site and reload (paste as one block):

```bash
sudo ln -sf /etc/nginx/sites-available/parents-playbook-api.kareerstudio.com /etc/nginx/sites-enabled/parents-playbook-api.kareerstudio.com
sudo nginx -t && sudo systemctl reload nginx
```

Add HTTPS (Certbot will edit the same file and add `listen 443 ssl`):

```bash
sudo certbot --nginx -d parents-playbook-api.kareerstudio.com
```

Follow the prompts (email, agree to terms). Choose redirect HTTP → HTTPS when asked.

Test:

```bash
curl http://127.0.0.1:5017/health
curl https://parents-playbook-api.kareerstudio.com/health
```

**If `nginx -t` fails:** check that nothing else uses port 80 for this hostname, or that the default site is not conflicting (`sudo rm /etc/nginx/sites-enabled/default` only if you do not need Hostinger’s default page on this VPS).

### A7. Updates (redeploy API)

```bash
cd ~/Parents_Playbook
git pull origin main
cd backend
npm install --omit=dev
pm2 restart parents-playbook-api
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
    : "https://parents-playbook-api.kareerstudio.com";
```

An **HTTP** landing page calling an **HTTPS** API is allowed in browsers. If your API hostname differs, change the production string before uploading.

### B4. Verify in browser

1. Open [http://kareerstudio.com/mydreams/](http://kareerstudio.com/mydreams/)
2. Submit **free preview** form (use your real email).
3. Submit **enquiry** from “Three ways to begin”.
4. Check inbox + `NOTIFY_EMAIL`.

If the form fails with CORS or network errors, confirm `CORS_ORIGINS` on the VPS includes  
`http://kareerstudio.com` (and other variants above), then `pm2 restart parents-playbook-api`.

---

## Part C — Post-deploy checklist

| Check | Action |
|-------|--------|
| API health | `curl https://parents-playbook-api.kareerstudio.com/health` → `{"ok":true}` |
| Node port | `curl http://127.0.0.1:5017/health` on VPS |
| SMTP | `npm run verify-smtp` in `backend/` |
| CORS | `CORS_ORIGINS` lists all live site origins (no trailing slash) |
| PDF | `~/Parents_Playbook/backend/assets/free-preview.pdf` on VPS only |
| Public PDF | Not under `public_html/mydreams/` on shared hosting |
| SSL | API at `https://parents-playbook-api.kareerstudio.com` |
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

- Confirm `parents-playbook-api.kareerstudio.com` resolves to the VPS.
- Confirm Nginx `proxy_pass` points to **5017** and `PORT=5017` in `.env`.
- Check `pm2 logs parents-playbook-api` for errors.

### Certbot: `NXDOMAIN` / DNS problem looking up A for parents-playbook-api.kareerstudio.com

Let's Encrypt cannot find your subdomain in public DNS. Nginx on the VPS is fine; the **domain record is missing or not propagated**.

1. In Hostinger **hPanel** → **Domains** → **kareerstudio.com** → **DNS / Manage DNS records**.
2. Add (or fix):

   | Type | Name | Content |
   |------|------|---------|
   | A | `parents-playbook-api` | Your VPS IPv4 (from `curl -4 -s ifconfig.me` on the VPS) |

   Do **not** type the full hostname in **Name** — only `parents-playbook-api`.

3. Remove wrong records (e.g. old `api` or `parent-playbook-api` without the **s**) if you renamed the subdomain.
4. Wait 5–30 minutes (sometimes longer), then on the VPS:

   ```bash
   dig +short parents-playbook-api.kareerstudio.com A @8.8.8.8
   ```

   When this prints your VPS IP:

   ```bash
   sudo certbot --nginx -d parents-playbook-api.kareerstudio.com
   ```

5. Ensure VPS firewall allows **80** and **443** (Hostinger VPS firewall / UFW):

   ```bash
   sudo ufw allow 80/tcp
   sudo ufw allow 443/tcp
   sudo ufw status
   ```

---

## GitHub workflow

1. Develop locally; push to [Parents_Playbook](https://github.com/akshayamin62/Parents_Playbook) (`.env` stays gitignored).
2. On VPS: `git pull` under `~/Parents_Playbook`, then `pm2 restart parents-playbook-api` from `backend/`.
3. On shared hosting: upload changed static files when `index.html` or assets change.

For local development, see [README.md](./README.md).