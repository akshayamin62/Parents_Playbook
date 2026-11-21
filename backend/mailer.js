import fs from "node:fs";
import path from "node:path";
import nodemailer from "nodemailer";
import { escapeForHtml } from "./validators.js";

function getTransport() {
  const port = Number(process.env.SMTP_PORT || 465);
  const secure =
    process.env.SMTP_SECURE === "true" ||
    (process.env.SMTP_SECURE !== "false" && port === 465);

  const user = (process.env.SMTP_USER || "").trim();
  const pass = (process.env.SMTP_PASS || "").replace(/\s/g, "");

  const options = {
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port,
    secure,
    auth: { user, pass },
  };

  if (port === 587) {
    options.secure = false;
    options.requireTLS = true;
  }

  return nodemailer.createTransport(options);
}

export function resolveMailFrom() {
  const user = (process.env.SMTP_USER || "").trim();
  if (process.env.MAIL_FROM?.trim()) return process.env.MAIL_FROM.trim();
  if (user) return `Kareer Studio <${user}>`;
  return "Kareer Studio";
}

function resolvePdfPath() {
  const configured = process.env.PDF_PATH || "./assets/free-preview.pdf";
  const primary = path.resolve(process.cwd(), configured);
  if (fs.existsSync(primary)) return primary;

  const fallback = path.resolve(process.cwd(), "../free-preview.pdf");
  if (fs.existsSync(fallback)) return fallback;

  return primary;
}

export async function sendPreviewEmails({ name, email, phone, city }) {
  const pdfPath = resolvePdfPath();
  if (!fs.existsSync(pdfPath)) {
    throw new Error(`PDF not found at ${pdfPath}. Copy free-preview.pdf to backend/assets/.`);
  }

  const from = resolveMailFrom();
  const notifyTo = process.env.NOTIFY_EMAIL || "hello@kareerstudio.com";
  const contactEmail =
    process.env.CONTACT_EMAIL || process.env.NOTIFY_EMAIL || "hello@kareerstudio.com";
  const transport = getTransport();

  const safe = {
    name: escapeForHtml(name),
    email: escapeForHtml(email),
    phone: escapeForHtml(phone),
    city: escapeForHtml(city),
  };

  await transport.sendMail({
    from,
    to: email,
    subject: "Your free preview — The Parent's Playbook",
    text: [
      `Hello ${name},`,
      "",
      "Thank you for your interest in The Parent's Playbook.",
      "Your 14-page free preview is attached to this email.",
      "",
      `If you have questions, reply to this message or write to ${contactEmail}.`,
      "",
      "Warm regards,",
      "Team Kareer Studio",
    ].join("\n"),
    attachments: [
      {
        filename: "Parents-Playbook-Free-Preview.pdf",
        path: pdfPath,
        contentType: "application/pdf",
      },
    ],
  });

  await transport.sendMail({
    from,
    to: notifyTo,
    subject: `New free preview request — ${name}`,
    html: `
      <p>A visitor requested the free preview PDF.</p>
      <ul>
        <li><strong>Name:</strong> ${safe.name}</li>
        <li><strong>Email:</strong> ${safe.email}</li>
        <li><strong>Mobile:</strong> ${safe.phone}</li>
        <li><strong>City:</strong> ${safe.city}</li>
      </ul>
      <p>The preview was emailed to them automatically.</p>
    `,
    text: [
      "New free preview request",
      "",
      `Name: ${name}`,
      `Email: ${email}`,
      `Mobile: ${phone}`,
      `City: ${city}`,
    ].join("\n"),
  });
}

export async function sendEnquiryNotification({ interest, name, phone, email, message }) {
  const from = resolveMailFrom();
  const notifyTo = process.env.NOTIFY_EMAIL || "hello@kareerstudio.com";
  const contactEmail =
    process.env.CONTACT_EMAIL || process.env.NOTIFY_EMAIL || "hello@kareerstudio.com";
  const transport = getTransport();

  const safe = {
    interest: escapeForHtml(interest),
    name: escapeForHtml(name),
    phone: escapeForHtml(phone),
    email: escapeForHtml(email),
    message: escapeForHtml(message),
  };

  const subject = `Parent's Playbook enquiry: ${interest}`;

  await transport.sendMail({
    from,
    to: notifyTo,
    replyTo: email,
    subject,
    html: `
      <p>New enquiry from the Parent's Playbook landing page.</p>
      <ul>
        <li><strong>Interested in:</strong> ${safe.interest}</li>
        <li><strong>Name:</strong> ${safe.name}</li>
        <li><strong>Mobile:</strong> ${safe.phone}</li>
        <li><strong>Email:</strong> <a href="mailto:${safe.email}">${safe.email}</a></li>
      </ul>
      <p><strong>Message:</strong></p>
      <p style="white-space: pre-wrap;">${safe.message}</p>
    `,
    text: [
      "New Parent's Playbook enquiry",
      "",
      `Interested in: ${interest}`,
      `Name: ${name}`,
      `Mobile: ${phone}`,
      `Email: ${email}`,
      "",
      "Message:",
      message,
    ].join("\n"),
  });

  await transport.sendMail({
    from,
    to: email,
    subject: "We received your enquiry — The Parent's Playbook",
    text: [
      `Hello ${name},`,
      "",
      `Thank you for your interest in: ${interest}.`,
      "",
      "We have received your enquiry and a member of the Kareer Studio team will reply to you by email soon.",
      "",
      "If you shared a question or context with us, we will read it carefully before responding.",
      "",
      "Warm regards,",
      "Team Kareer Studio",
    ].join("\n"),
  });
}