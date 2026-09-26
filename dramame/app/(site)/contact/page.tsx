import type { Metadata } from "next";
import { ContactForm } from "@/components/contact-form";

export const metadata: Metadata = { title: "Contact" };

export default function ContactPage() {
  return (
    <main className="narrow page">
      <p className="eyebrow">Contact</p>
      <h1>Write to dramame</h1>
      <p className="lede">
        Email <a href="mailto:hello@dramame.net">hello@dramame.net</a>. The form below saves your note on this server. It does not send mail.
      </p>
      <p className="contact-address">hello@dramame.net</p>
      <ContactForm />
    </main>
  );
}
