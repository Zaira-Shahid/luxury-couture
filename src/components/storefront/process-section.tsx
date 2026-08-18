import { Palette, Ruler, Scissors, Truck } from "lucide-react";

import { ScrollReveal } from "@/components/motion/scroll-reveal";

const STEPS = [
  { icon: Palette, title: "Design", description: "Choose a piece or design your own from scratch." },
  { icon: Ruler, title: "Measure", description: "Share your measurements or book a fitting." },
  { icon: Scissors, title: "Craft", description: "Our artisans hand-embroider and tailor your piece." },
  { icon: Truck, title: "Deliver", description: "Your finished lehenga arrives, ready to wear." },
] as const;

export function ProcessSection() {
  return (
    <section className="container py-20">
      <ScrollReveal>
        <h2 className="mb-12 text-center font-heading text-3xl sm:text-4xl">How It Works</h2>
      </ScrollReveal>
      <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((step, i) => (
          <ScrollReveal key={step.title} delay={i * 0.08} className="text-center">
            <step.icon className="mx-auto size-8 text-accent" strokeWidth={1.5} />
            <p className="mt-4 font-heading text-xl">{step.title}</p>
            <p className="mt-2 text-sm text-muted-foreground">{step.description}</p>
          </ScrollReveal>
        ))}
      </div>
    </section>
  );
}
