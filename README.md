# The Parent's Playbook — Landing Page

Marketing site for *The Parent's Playbook* by Makarand Bhatt: static frontend plus a small Node.js API for **free preview** (email PDF) and **enquiries** (“Three ways to begin”).

**Repository:** [github.com/akshayamin62/Parents_Playbook](https://github.com/akshayamin62/Parents_Playbook)  
**Live site:** [http://kareerstudio.com/mydreams/](http://kareerstudio.com/mydreams/)  
**API (production):** `https://parents-playbook-api.kareerstudio.com` (Node on VPS port **5017** behind Nginx)

## Architecture

| Part | Hosting | Role |
|------|---------|------|
| **Frontend** | Hostinger **shared** | `index.html`, images — no server code |
| **Backend** | Hostinger **VPS** | Express API, SMTP, PDF attachment |

The landing page calls the API over HTTPS with CORS.

## Repository layout

```
├── frontend/               # Upload entire folder → public_html/mydreams/
│   ├── index.html
│   ├── author.webp
│   ├── book-cover.png
│   ├── privacy-policy.html
│   ├── disclaimer.html
│   ├── legal.css
│   └── .htaccess
├── free-preview.pdf        # Copy to VPS backend/assets only (not shared hosting)
├── DEPLOYMENT.md           # Full production setup (shared + VPS)
└── backend/
    ├── server.js           # POST /free-preview, POST /enquiry, GET /health
    ├── mailer.js
    ├── validators.js
    ├── .env.example
    └── scripts/verify-smtp.mjs
```

## Features

- **Free preview:** Name, mobile, email, city → PDF emailed to visitor; team notified.
- **Enquiry:** Interest, name, email, message → team notified + acknowledgment to visitor.
- Preview is **not** linked as a public download on the site (gate via email).

## Local development

### 1. Backend

```bash
cd backend
cp .env.example .env
# Local: set PORT=3847 in .env if you prefer; production VPS uses 5017
mkdir -p assets && cp ../free-preview.pdf assets/
npm install
npm run verify-smtp
npm run dev
```

### 2. Frontend

```bash
npx serve frontend -l 5500
```

Open `http://localhost:5500`. On localhost, the page uses `http://localhost:3847` for the API.

## Production deployment

See **[DEPLOYMENT.md](./DEPLOYMENT.md)** — clone on VPS:

```bash
git clone https://github.com/akshayamin62/Parents_Playbook.git
```

## API (summary)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Uptime check |
| `POST` | `/free-preview` | `{ name, email, phone, city }` |
| `POST` | `/enquiry` | `{ interest, name, email, message? }` |

## Security notes

- Do **not** commit `backend/.env` (listed in `.gitignore`).
- Use a **Google App Password** for `SMTP_PASS`.
- `SMTP_USER` and `MAIL_FROM` must match the sending Gmail account.

## License

Proprietary — Kareer Studio / Makarand Bhatt.