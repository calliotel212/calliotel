import "server-only";

import { Resend } from "resend";

type EmailKind = "verify" | "reset";

export async function sendEmail(input: { to: string; kind: EmailKind; url: string }): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();
  if (!apiKey || !from) return;

  const resend = new Resend(apiKey);
  const content = contentFor(input.kind, input.url);
  try {
    const { error } = await resend.emails.send({
      from,
      to: input.to,
      subject: content.subject,
      text: content.text,
      html: content.html,
    });
    if (error) throw new Error("Could not send email.");
  } catch (error) {
    if (error instanceof Error && error.message === "Could not send email.") throw error;
    throw new Error("Could not send email.");
  }
}

function contentFor(kind: EmailKind, url: string): { subject: string; text: string; html: string } {
  const safeUrl = escapeHtml(url);
  if (kind === "reset") {
    return {
      subject: "Reset your Drama Me password",
      text: `Reset your Drama Me password by opening this link:\n\n${url}\n\nIf you did not ask for a reset, you can ignore this message.`,
      html: `<p>Reset your Drama Me password by opening this link:</p><p><a href="${safeUrl}">${safeUrl}</a></p><p>If you did not ask for a reset, you can ignore this message.</p>`,
    };
  }
  return {
    subject: "Verify your Drama Me email",
    text: `Verify your Drama Me email by opening this link:\n\n${url}\n\nIf you did not create an account, you can ignore this message.`,
    html: `<p>Verify your Drama Me email by opening this link:</p><p><a href="${safeUrl}">${safeUrl}</a></p><p>If you did not create an account, you can ignore this message.</p>`,
  };
}

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}
