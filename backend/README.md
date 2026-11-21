# Parents Playbook API

Node.js API for the Parent's Playbook landing page:

- `POST /free-preview` — emails the PDF to the visitor and notifies `NOTIFY_EMAIL`
- `POST /enquiry` — notifies `NOTIFY_EMAIL` and sends an acknowledgment to the visitor

**Full deployment (shared hosting + VPS):** see [../DEPLOYMENT.md](../DEPLOYMENT.md).

## 1. Prepare files on the VPS

```bash
cd /var/www/parents-playbook-api   # or your chosen path
# Upload this backend/ folder, then:
npm install --omit=dev
cp /path/to/free-preview.pdf ./assets/free-preview.pdf
cp .env.example .env
# Edit .env with real SMTP credentials
```

## 2. Environment variables

See `.env.example`. Required for sending mail:

- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`
- `CORS_ORIGINS` — must include `https://www.kareerstudio.com`
- `NOTIFY_EMAIL` — defaults to `hello@kareerstudio.com` in code if unset

**Gmail (recommended for your setup):**

- `SMTP_HOST=smtp.gmail.com`
- `SMTP_PORT=465`, `SMTP_SECURE=true`
- `SMTP_USER=kareerstudio@gmail.com`
- `SMTP_PASS` = [Google App Password](https://myaccount.google.com/apppasswords) (16 characters, no spaces)
- `MAIL_FROM="Kareer Studio <kareerstudio@gmail.com>"`
- Turn on **2-Step Verification** on the Google account before creating an App Password.

**Hostinger mailbox (alternative):**

- Host: `smtp.hostinger.com`, port `465`, `SMTP_SECURE=true`

## 3. Run with PM2

```bash
npm install -g pm2
pm2 start server.js --name playbook-preview-api
pm2 save
pm2 startup
```

## 4. Nginx reverse proxy (example)

Point `parents-playbook-api.kareerstudio.com` to this app (port `5017` on VPS):

```nginx
server {
    listen 443 ssl http2;
    server_name parents-playbook-api.kareerstudio.com;

    # ssl_certificate ... (Certbot)

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

Then issue TLS: `certbot --nginx -d parents-playbook-api.kareerstudio.com`

## 5. Frontend

In `index.html`, set `PLAYBOOK_API_BASE` to your public API URL, e.g.:

```js
const PLAYBOOK_API_BASE = "https://parents-playbook-api.kareerstudio.com";
```

Requests go to `POST .../free-preview` and `POST .../enquiry`.

## 6. Remove public PDF from the website

After this is live, **do not** upload `free-preview.pdf` to `/mydreams/` on the main site so the preview is only available via email.

Test SMTP: `npm run verify-smtp`

## Local test

```bash
cp .env.example .env
# Fill SMTP and CORS_ORIGINS=http://127.0.0.1:5500 (or your local static server origin)
mkdir -p assets && cp ../free-preview.pdf assets/
npm run dev
```

```bash
curl -X POST http://localhost:3847/free-preview \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","email":"you@example.com","phone":"9876543210","city":"Mumbai"}'
```