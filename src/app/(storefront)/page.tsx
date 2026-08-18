import { siteConfig } from "@/lib/config/site";

export default function HomePage() {
  return (
    <div className="container flex min-h-[70vh] flex-col items-center justify-center gap-4 text-center">
      <p className="text-sm tracking-[0.3em] text-muted-foreground uppercase">
        Coming soon
      </p>
      <h1 className="font-heading text-4xl sm:text-6xl">{siteConfig.name}</h1>
      <p className="max-w-xl text-muted-foreground">{siteConfig.description}</p>
    </div>
  );
}
