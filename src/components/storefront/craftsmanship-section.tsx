import { ScrollReveal } from "@/components/motion/scroll-reveal";

export function CraftsmanshipSection() {
  return (
    <section className="bg-secondary/50 py-20">
      <div className="container grid grid-cols-1 items-center gap-10 lg:grid-cols-2">
        <ScrollReveal>
          <div className="aspect-[4/5] rounded-xl bg-gradient-to-br from-muted to-secondary" />
        </ScrollReveal>
        <ScrollReveal delay={0.1}>
          <p className="text-xs tracking-[0.3em] text-muted-foreground uppercase">
            Our Craft
          </p>
          <h2 className="mt-3 font-heading text-3xl sm:text-4xl">
            Hand-Embroidered, Hand-Finished
          </h2>
          <p className="mt-4 max-w-md text-muted-foreground">
            Every piece is cut and embroidered by our in-house artisans, using techniques passed
            down through generations — zardozi, gota, and dabka work, layered by hand over
            weeks, not machines in minutes.
          </p>
        </ScrollReveal>
      </div>
    </section>
  );
}
