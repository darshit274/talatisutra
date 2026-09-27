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
