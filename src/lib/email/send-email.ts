import "server-only";

import nodemailer from "nodemailer";

import { getEmailNotificationSettingsWithPassword } from "@/lib/email/email-settings";

export type SendEmailInput = {
  to: string;
  cc?: string | string[] | null;
  subject: string;
  text: string;
};

export type SendEmailResult =
  | { success: true; messageId: string }
  | { success: false; reason: string; error?: unknown };

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  try {
    const settings = await getEmailNotificationSettingsWithPassword();
    if (!settings.enabled) {
      return { success: false, reason: "Email notifications are disabled." };
    }
    if (!settings.smtpHost || !settings.smtpPort || !settings.fromEmail) {
      return { success: false, reason: "SMTP settings are incomplete." };
    }

    const transport = nodemailer.createTransport({
      host: settings.smtpHost,
      port: settings.smtpPort,
      secure: settings.smtpSecure,
      auth:
        settings.smtpUsername || settings.smtpPassword
          ? {
              user: settings.smtpUsername,
              pass: settings.smtpPassword,
            }
          : undefined,
    });

    const info = await transport.sendMail({
      from: settings.fromName ? `"${settings.fromName}" <${settings.fromEmail}>` : settings.fromEmail,
      to: input.to,
      cc: input.cc ?? undefined,
      replyTo: settings.replyToEmail || undefined,
      subject: input.subject,
      text: input.text,
    });

    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("[email] Failed to send email", error);
    return {
      success: false,
      reason: "Unable to send test email. Check SMTP settings.",
      error,
    };
  }
}
