import {
  Cormorant_Garamond,
  Geist,
  Inter,
  Libre_Baskerville,
  Playfair_Display,
  Source_Sans_3,
} from "next/font/google";

import type { FontPreset } from "./registry";

/**
 * Font pairings, loaded at build time.
 *
 * `next/font` resolves fonts during the build — it self-hosts the files
 * and generates the CSS. That is why typography is a CHOICE BETWEEN
 * PREPARED SETS rather than a font-name field: a name pulled from the
 * database at runtime could not be loaded this way, and a free-text
 * field would silently do nothing.
 *
 * Every preset below is bundled whether or not it is selected, so keep
 * this list short — each pairing adds to the served font payload.
 */

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-heading",
});
const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-heading",
});
const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

const libre = Libre_Baskerville({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-heading",
});
const sourceSans = Source_Sans_3({ subsets: ["latin"], variable: "--font-sans" });

/**
 * Returns the two `variable` class names for a preset. Applied to
 * <html>, they define --font-heading and --font-sans, which globals.css
 * maps into Tailwind's theme.
 */
export function fontClassesFor(preset: FontPreset): string {
  switch (preset) {
    case "playfair-inter":
      return `${playfair.variable} ${inter.variable}`;
    case "libre-source":
      return `${libre.variable} ${sourceSans.variable}`;
    case "cormorant-geist":
    default:
      return `${cormorant.variable} ${geist.variable}`;
  }
}
