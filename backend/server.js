import "dotenv/config";
import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { sendEnquiryNotification, sendPreviewEmails } from "./mailer.js";
import { validateEnquiryRequest, validatePreviewRequest } from "./validators.js";

const app = express();
const port = Number(process.env.PORT || 3847);

const corsOrigins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

if (corsOrigins.length === 0) {
  console.warn(
    "CORS_ORIGINS is empty — browser requests from the live site will be blocked until you set it in .env"
  );
}

app.use(helmet());
app.use(express.json({ limit: "16kb" }));
app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (corsOrigins.includes(origin)) return callback(null, true);
      callback(new Error("Not allowed by CORS"));
    },
  })
);

const formLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please try again later." },
});

function requireSmtpConfig(req, res, next) {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return res.status(503).json({
      error: "Email service is not configured. Set SMTP variables on the server.",
    });
  }
  next();
}

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "parents-playbook-preview-api" });
});

app.post("/enquiry", formLimiter, requireSmtpConfig, async (req, res) => {
  const validation = validateEnquiryRequest(req.body);
  if (!validation.ok) {
    return res.status(400).json({ error: validation.error });
  }

  try {
    await sendEnquiryNotification(validation.data);
    return res.json({
      ok: true,
      message:
        "Thank you. Your enquiry was sent to our team. We will reply by email soon.",
    });
  } catch (err) {
    console.error("[enquiry]", err);
    if (err.code === "EAUTH") {
      return res.status(503).json({
        error:
          "Email could not be sent (server mail login failed). Check Gmail App Password in backend .env.",
      });
    }
    return res.status(500).json({
      error: "We could not send your enquiry right now. Please try again shortly.",
    });
  }
});

app.post("/free-preview", formLimiter, requireSmtpConfig, async (req, res) => {
  const validation = validatePreviewRequest(req.body);
  if (!validation.ok) {
    return res.status(400).json({ error: validation.error });
  }

  try {
    await sendPreviewEmails(validation.data);
    return res.json({
      ok: true,
      message: "Preview sent. Please check your inbox (and spam folder).",
    });
  } catch (err) {
    console.error("[free-preview]", err);
    if (err.code === "EAUTH") {
      return res.status(503).json({
        error:
          "Email could not be sent (server mail login failed). Check Gmail App Password in backend .env.",
      });
    }
    const message = err.message?.includes("PDF not found")
      ? "Preview file is missing on the server. Contact support."
      : "We could not send the preview right now. Please try again shortly.";
    return res.status(500).json({ error: message });
  }
});

app.use((err, _req, res, next) => {
  if (err.message === "Not allowed by CORS") {
    return res.status(403).json({ error: "Origin not allowed." });
  }
  next(err);
});

app.listen(port, () => {
  console.log(`Preview API listening on port ${port}`);
});