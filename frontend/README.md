# Frontend — upload this folder to shared hosting

Upload **everything in this folder** to Hostinger:

**Target path:** `public_html/mydreams/`

**Live URL:** [http://kareerstudio.com/mydreams/](http://kareerstudio.com/mydreams/)

## Files (select all → upload)

| File | Purpose |
|------|---------|
| `index.html` | Landing page |
| `author.webp` | Author image |
| `book-cover.png` | Cover image |
| `privacy-policy.html` | Privacy policy |
| `disclaimer.html` | Disclaimer |
| `legal.css` | Styles for policy pages |
| `.htaccess` | Block direct PDF access if uploaded by mistake |

Do **not** add `free-preview.pdf` here (PDF is sent by email from the VPS only).

## Hostinger File Manager

1. Open `public_html/mydreams/`
2. **Upload** → select **all files** in this folder (include `.htaccess`)
3. Visit `http://kareerstudio.com/mydreams/`

## Local preview

From the repo root:

```bash
npx serve frontend -l 5500
```

Open `http://localhost:5500`