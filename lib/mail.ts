import nodemailer from "nodemailer";
import { env } from "@/lib/env";

// One transport, created once and reused (BUILD-PLAN §8).
const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_SECURE,
  auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
});

async function safeSend(options: Parameters<typeof transporter.sendMail>[0]): Promise<void> {
  try {
    await transporter.sendMail({ from: env.MAIL_FROM, ...options });
  } catch (error) {
    // A mail failure must never break the user-facing action (BUILD-PLAN §8) — the
    // caller has already done whatever DB write mattered (created the reset token,
    // saved the enquiry, etc.) before calling this.
    console.error("Failed to send email:", error);
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function emailShell(title: string, bodyHtml: string): string {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <tr>
        <td style="padding: 24px 0;">
          <h1 style="font-size: 18px; margin: 0 0 16px; color: #111;">${title}</h1>
          ${bodyHtml}
        </td>
      </tr>
    </table>
  `;
}

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  await safeSend({
    to,
    subject: "Reset your password",
    html: emailShell(
      "Reset your password",
      `
        <p style="margin: 0 0 16px; color: #333;">
          We received a request to reset the password for your employee portal account.
          This link expires in 1 hour and can only be used once.
        </p>
        <p style="margin: 0 0 16px;">
          <a href="${resetUrl}" style="display:inline-block;background:#111;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;">
            Reset password
          </a>
        </p>
        <p style="margin: 0; color: #666; font-size: 13px;">
          If you didn't request this, you can safely ignore this email.
        </p>
      `,
    ),
  });
}

export interface ContactEnquiryDetails {
  name: string;
  email: string;
  phone?: string;
  subject?: string;
  message: string;
}

export async function sendContactEnquiryEmail(enquiry: ContactEnquiryDetails): Promise<void> {
  const rows = [
    ["Name", enquiry.name],
    ["Email", enquiry.email],
    ["Phone", enquiry.phone || "—"],
    ["Subject", enquiry.subject || "—"],
  ]
    .map(
      ([label, value]) => `
        <tr>
          <td style="padding: 4px 12px 4px 0; color: #666; font-size: 13px; white-space: nowrap;">${label}</td>
          <td style="padding: 4px 0; color: #111; font-size: 13px;">${escapeHtml(value)}</td>
        </tr>
      `,
    )
    .join("");

  await safeSend({
    to: env.CONTACT_NOTIFY_EMAIL,
    // Replying in the mail client goes straight to the enquirer, not MAIL_FROM
    // (BUILD-PLAN §8).
    replyTo: enquiry.email,
    subject: enquiry.subject ? `Contact form: ${enquiry.subject}` : "New contact form enquiry",
    html: emailShell(
      "New contact enquiry",
      `
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 0 16px;">
          ${rows}
        </table>
        <p style="margin: 0 0 8px; color: #666; font-size: 13px;">Message</p>
        <p style="margin: 0; color: #111; white-space: pre-wrap;">${escapeHtml(enquiry.message)}</p>
      `,
    ),
  });
}

export async function sendNewAccountEmail(to: string, tempPassword: string): Promise<void> {
  await safeSend({
    to,
    subject: "Your employee portal account",
    html: emailShell(
      "Your account is ready",
      `
        <p style="margin: 0 0 16px; color: #333;">
          An administrator created an employee portal account for you. Sign in with
          the temporary password below — you'll be asked to set your own the first
          time you log in.
        </p>
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 0 16px;">
          <tr>
            <td style="padding: 4px 12px 4px 0; color: #666; font-size: 13px;">Email</td>
            <td style="padding: 4px 0; color: #111; font-size: 13px;">${escapeHtml(to)}</td>
          </tr>
          <tr>
            <td style="padding: 4px 12px 4px 0; color: #666; font-size: 13px;">Temporary password</td>
            <td style="padding: 4px 0; color: #111; font-size: 13px; font-family: monospace;">${escapeHtml(tempPassword)}</td>
          </tr>
        </table>
        <p style="margin: 0;">
          <a href="${env.APP_URL}/login" style="display:inline-block;background:#111;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;">
            Sign in
          </a>
        </p>
      `,
    ),
  });
}
