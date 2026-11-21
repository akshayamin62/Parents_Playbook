import validator from "validator";

const LIMITS = {
  name: 100,
  email: 254,
  phone: 20,
  city: 80,
};

export function validatePreviewRequest(body) {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Invalid request body." };
  }

  const name = String(body.name ?? "").trim();
  const email = String(body.email ?? "").trim();
  const phone = String(body.phone ?? "").trim();
  const city = String(body.city ?? "").trim();

  if (!name || name.length > LIMITS.name) {
    return { ok: false, error: "Please enter your name (up to 100 characters)." };
  }
  if (!email || !validator.isEmail(email) || email.length > LIMITS.email) {
    return { ok: false, error: "Please enter a valid email address." };
  }
  if (!phone || phone.length > LIMITS.phone) {
    return { ok: false, error: "Please enter your mobile number." };
  }
  if (!/^[+()\d\s.-]{7,20}$/.test(phone)) {
    return { ok: false, error: "Please enter a valid mobile number." };
  }
  if (!city || city.length > LIMITS.city) {
    return { ok: false, error: "Please enter your city." };
  }

  const normalizedEmail = validator.normalizeEmail(email);
  if (!normalizedEmail) {
    return { ok: false, error: "Please enter a valid email address." };
  }

  return {
    ok: true,
    data: { name, email: normalizedEmail, phone, city },
  };
}

const ENQUIRY_INTERESTS = [
  "Digital playbook",
  "Parent workshop",
  "One-to-one interactive session",
  "General enquiry",
];

export function validateEnquiryRequest(body) {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Invalid request body." };
  }

  const interest = String(body.interest ?? "").trim();
  const name = String(body.name ?? "").trim();
  const phone = String(body.phone ?? "").trim();
  const email = String(body.email ?? "").trim();
  const message = String(body.message ?? "").trim();

  if (!ENQUIRY_INTERESTS.includes(interest)) {
    return { ok: false, error: "Please select what you are interested in." };
  }
  if (!name || name.length > LIMITS.name) {
    return { ok: false, error: "Please enter your name (up to 100 characters)." };
  }
  if (!phone || phone.length > LIMITS.phone) {
    return { ok: false, error: "Please enter your mobile number." };
  }
  if (!/^[+()\d\s.-]{7,20}$/.test(phone)) {
    return { ok: false, error: "Please enter a valid mobile number." };
  }
  if (!email || !validator.isEmail(email) || email.length > LIMITS.email) {
    return { ok: false, error: "Please enter a valid email address." };
  }
  if (message.length > 800) {
    return { ok: false, error: "Message is too long (max 800 characters)." };
  }

  const normalizedEmail = validator.normalizeEmail(email);
  if (!normalizedEmail) {
    return { ok: false, error: "Please enter a valid email address." };
  }

  return {
    ok: true,
    data: {
      interest,
      name,
      phone,
      email: normalizedEmail,
      message: message || "Please send me the details.",
    },
  };
}

export function escapeForHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}