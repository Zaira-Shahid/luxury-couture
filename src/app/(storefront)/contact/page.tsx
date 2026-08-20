import type { Metadata } from "next";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { WhatsAppCta } from "@/components/storefront/whatsapp-cta";
import { getSiteSettings } from "@/lib/settings/get-site-settings";

import { ContactForm } from "./contact-form";

export const metadata: Metadata = { title: "Contact" };

export default async function ContactPage() {
  const settings = await getSiteSettings();

  return (
    <div className="container max-w-xl py-16">
      <Card>
        <CardHeader>
          <CardTitle>Get in Touch</CardTitle>
          <CardDescription>
            Questions about a piece, an order, or anything else — we&apos;re happy to help.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <ContactForm />
          <WhatsAppCta url={settings.store.socialLinks.whatsapp} />
        </CardContent>
      </Card>
    </div>
  );
}
