import { ScrollReveal } from "@/components/motion/scroll-reveal";
import { Button } from "@/components/ui/button";

/**
 * Links via mailto: using the contact email from site_settings — Module 9
 * ("Enquiries, Consultations & Contact") is where a real booking flow gets
 * built; linking anywhere else today would be a dead/fake link.
 */
export function ConsultationCta({ contactEmail }: { contactEmail: string | null }) {
  const email = contactEmail ?? "hello@luxurylehengacouture.com";

  return (
    <section className="bg-primary py-20 text-primary-foreground">
      <div className="container flex flex-col items-center gap-4 text-center">
        <ScrollReveal>
          <h2 className="font-heading text-3xl sm:text-4xl">Book a Private Consultation</h2>
          <p className="mx-auto mt-3 max-w-md text-primary-foreground/80">
            Sit down with our design team to plan your bespoke piece — in person or virtually.
          </p>
          <Button
            render={<a href={`mailto:${email}`} />}
            variant="secondary"
            size="lg"
            className="mt-6"
          >
            Enquire Now
          </Button>
        </ScrollReveal>
      </div>
    </section>
  );
}
