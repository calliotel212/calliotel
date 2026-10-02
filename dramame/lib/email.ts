import "server-only";

import { Resend } from "resend";

type EmailKind = "verify" | "reset";

export async function sendEmail(input: { to: string; kind: EmailKind; url: string }): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();
  if (!apiKey || !from) {
    const missing = [apiKey ? null : "RESEND_API_KEY", from ? null : "EMAIL_FROM"].filter((name) => name !== null);
    console.error(`sendEmail skipped for ${input.to}: missing ${missing.join(", ")}`);
    return;
  }

  const resend = new Resend(apiKey);
  const content = contentFor(input.kind, input.url);
  const secrets = redactedSecrets(apiKey, from);
  try {
    const { error } = await resend.emails.send({
      from,
      to: input.to,
      subject: content.subject,
      text: content.text,
      html: content.html,
    });
    if (error) {
      const reason = error.message || "Resend rejected the email";
      const body = redact(JSON.stringify(error), secrets);
      if (typeof error.statusCode === "number") {
        console.error(`sendEmail failed for ${input.to}: ${redact(reason, secrets)} status=${error.statusCode} body=${body}`);
      } else {
        console.error(`sendEmail failed for ${input.to}: ${redact(reason, secrets)} body=${body}`);
      }
      throw new Error("Could not send email.");
    }
  } catch (error) {
    if (error instanceof Error && error.message === "Could not send email.") throw error;
    const reason = error instanceof Error ? error.message : "unknown error";
    console.error(`sendEmail failed for ${input.to}: ${redact(reason, secrets)}`);
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

function redactedSecrets(apiKey: string, from: string): string[] {
  const secrets = [apiKey];
  if (from.includes(apiKey) || /bearer\s+\S+/i.test(from) || /\bre_[A-Za-z0-9]{8,}/.test(from)) secrets.push(from);
  return secrets;
}

function redact(value: string, secrets: string[]): string {
  let text = value.replace(/Bearer\s+\S+/gi, "Bearer [redacted]");
  for (const secret of secrets) {
    if (secret) text = text.split(secret).join("[redacted]");
  }
  return text;
}
