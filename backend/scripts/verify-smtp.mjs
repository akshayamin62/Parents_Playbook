import "dotenv/config";
import nodemailer from "nodemailer";

const port = Number(process.env.SMTP_PORT || 465);
const secure = process.env.SMTP_SECURE !== "false";
const user = (process.env.SMTP_USER || "").trim();
const pass = (process.env.SMTP_PASS || "").replace(/\s/g, "");

if (!user || !pass) {
  console.error("Set SMTP_USER and SMTP_PASS in backend/.env");
  process.exit(1);
}

const transport = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port,
  secure,
  auth: { user, pass },
});

try {
  await transport.verify();
  console.log("OK — SMTP login works for", user);
} catch (err) {
  console.error("SMTP verify failed:", err.message);
  if (err.code === "EAUTH") {
    console.error(`
Tips:
  • SMTP_USER and MAIL_FROM should use the same address.
  • Use a Google App Password (16 chars), not your normal password.
  • @coed.svnit.ac.in (Workspace) often blocks SMTP for students — use
    kareerstudio@gmail.com or your personal Gmail for testing instead.
  • Create App Password: https://myaccount.google.com/apppasswords
`);
  }
  process.exit(1);
}