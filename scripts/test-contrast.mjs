// Module 28 Pass 1 — WCAG contrast, computed rather than eyeballed.
//
// "Colour contrast" is the one item on this module's audit list that can
// be settled by arithmetic instead of judgement, so it is settled that
// way: parse the design tokens out of globals.css, convert OKLCH to
// sRGB, and compute the WCAG 2.1 contrast ratio for every foreground /
// background pair the app actually renders — in BOTH themes.
//
// This needs no browser, which matters: Lighthouse cannot run in this
// environment (no Chromium), so an assertion like "contrast is fine"
// would otherwise be untestable and therefore worthless.
//
//   node scripts/test-contrast.mjs
import { readFileSync } from "node:fs";

let passed = 0;
let failed = 0;
const failures = [];
function check(label, ok, detail) {
  console.log(`${ok ? "PASS" : "FAIL"} — ${label}${detail ? ` (${detail})` : ""}`);
  if (ok) passed += 1;
  else {
    failed += 1;
    failures.push(label);
  }
}

// ---------------------------------------------------------------------
// OKLCH -> linear sRGB -> relative luminance.
//
// Implements the Oklab reference conversion (Björn Ottosson). The app's
// tokens are authored in oklch(), so a parser that only understood hex
// would silently check nothing at all.

function oklchToLinearSrgb(L, C, hDeg) {
  const h = (hDeg * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);

  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;

  const l = l_ ** 3;
  const m = m_ ** 3;
  const s = s_ ** 3;

  return [
    +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

/** WCAG relative luminance. Operates on LINEAR values, so no gamma step. */
function relativeLuminance([r, g, b]) {
  const clamp = (v) => Math.min(1, Math.max(0, v));
  return 0.2126 * clamp(r) + 0.7152 * clamp(g) + 0.0722 * clamp(b);
}

function contrastRatio(colorA, colorB) {
  const a = relativeLuminance(colorA);
  const b = relativeLuminance(colorB);
  const [light, dark] = a > b ? [a, b] : [b, a];
  return (light + 0.05) / (dark + 0.05);
}

/**
 * Composites a possibly-translucent token over an opaque backdrop.
 *
 * Done in LINEAR light, which is where alpha blending is physically
 * correct; compositing gamma-encoded values is the usual way to get a
 * plausible-looking but wrong answer.
 */
function composite(token, backdrop) {
  if (token.alpha >= 1) return token.color;
  return token.color.map((c, i) => c * token.alpha + backdrop.color[i] * (1 - token.alpha));
}

// ---------------------------------------------------------------------
// Token parsing

const css = readFileSync("src/app/globals.css", "utf8");

function parseBlock(selector) {
  const match = css.match(new RegExp(`${selector}\\s*\\{([\\s\\S]*?)\\n\\}`));
  if (!match) return null;

  const tokens = {};
  const re = /--([a-z0-9-]+):\s*oklch\(([^)]+)\)/gi;
  let m;
  while ((m = re.exec(match[1])) !== null) {
    // Alpha form: `oklch(1 0 0 / 12%)`. An earlier version of this parser
    // skipped these outright and reported "token missing", which read as
    // a design failure when it was a gap in the checker. A translucent
    // border is a real colour — it just has to be composited over its
    // backdrop before it means anything.
    const [colorPart, alphaPart] = m[2].split("/");
    const parts = colorPart.trim().split(/\s+/).map(Number);
    if (parts.length < 3 || parts.some((n) => Number.isNaN(n))) continue;

    let alpha = 1;
    if (alphaPart !== undefined) {
      const raw = alphaPart.trim();
      const value = Number(raw.replace("%", ""));
      alpha = raw.includes("%") ? value / 100 : value;
      if (Number.isNaN(alpha)) alpha = 1;
    }

    tokens[m[1]] = { color: oklchToLinearSrgb(parts[0], parts[1], parts[2]), alpha };
  }
  return tokens;
}

const light = parseBlock(":root");
const dark = parseBlock("\\.dark");

check(
  "light theme tokens parsed",
  !!light && Object.keys(light).length > 10,
  `${Object.keys(light ?? {}).length} tokens`
);
check(
  "dark theme tokens parsed",
  !!dark && Object.keys(dark).length > 10,
  `${Object.keys(dark ?? {}).length} tokens`
);

// ---------------------------------------------------------------------
// The pairs the app actually renders.
//
// 4.5 is WCAG AA for body text. 3.0 is SC 1.4.11 for non-text UI, which
// covers the visual information needed to IDENTIFY a control — an input's
// boundary and the focus ring — which is why those carry the lower bar
// rather than being exempt from one.
const PAIRS = [
  ["foreground", "background", 4.5, "body text"],
  ["card-foreground", "card", 4.5, "text on cards"],
  ["popover-foreground", "popover", 4.5, "text in popovers"],
  ["primary-foreground", "primary", 4.5, "primary button label"],
  ["secondary-foreground", "secondary", 4.5, "secondary button label"],
  ["accent-foreground", "accent", 4.5, "accent button label"],
  ["destructive-foreground", "destructive", 4.5, "destructive button label"],
  ["muted-foreground", "background", 4.5, "muted text on page"],
  ["muted-foreground", "muted", 4.5, "muted text on muted"],
  ["muted-foreground", "card", 4.5, "muted text on cards"],
  ["sidebar-foreground", "sidebar", 4.5, "admin sidebar text"],
  ["sidebar-primary-foreground", "sidebar-primary", 4.5, "admin sidebar active item"],
  ["sidebar-accent-foreground", "sidebar-accent", 4.5, "admin sidebar accent"],
  ["input", "background", 3.0, "input field boundary"],
  ["input", "card", 3.0, "input boundary on cards"],
  ["ring", "background", 3.0, "focus ring against the page"],
  ["ring", "card", 3.0, "focus ring on cards"],
  ["sidebar-ring", "sidebar", 3.0, "focus ring in the admin sidebar"],
];

/**
 * Reported, never failed.
 *
 * `--border` is a decorative hairline between sections. SC 1.4.11 covers
 * information required to understand or operate the interface, and a
 * divider is neither — holding every 1px rule to 3:1 would turn an
 * editorial layout into a wireframe, and would be a misreading of the
 * criterion rather than an unusually strict one. The number is printed so
 * the decision stays visible instead of silently assumed.
 */
const INFORMATIONAL = [["border", "background", "decorative dividers"]];

for (const [themeName, tokens] of [
  ["light", light],
  ["dark", dark],
]) {
  console.log(`\n# ${themeName} theme`);
  if (!tokens) {
    check(`${themeName} theme is checkable`, false, "tokens did not parse");
    continue;
  }

  for (const [fg, bg, minimum, description] of PAIRS) {
    if (!tokens[fg] || !tokens[bg]) {
      check(`${themeName}: ${fg} on ${bg}`, false, "token missing");
      continue;
    }
    const ratio = contrastRatio(
      composite(tokens[fg], tokens[bg]),
      composite(tokens[bg], tokens[bg])
    );
    check(
      `${themeName}: ${description} (${fg} on ${bg}) meets ${minimum}:1`,
      ratio >= minimum,
      `${ratio.toFixed(2)}:1`
    );
  }
}

console.log("\n# Informational — reported, not failed (see INFORMATIONAL)");
for (const [themeName, tokens] of [
  ["light", light],
  ["dark", dark],
]) {
  for (const [fg, bg, description] of INFORMATIONAL) {
    if (!tokens?.[fg] || !tokens?.[bg]) continue;
    const ratio = contrastRatio(
      composite(tokens[fg], tokens[bg]),
      composite(tokens[bg], tokens[bg])
    );
    console.log(`      ${themeName}: ${description} (${fg} on ${bg}) = ${ratio.toFixed(2)}:1`);
  }
}

// ---------------------------------------------------------------------
// A guard on the guard. If the maths were wrong — a bad OKLCH conversion,
// say — every pair could pass vacuously. These assert known-extreme
// values so a broken implementation fails loudly instead of silently
// blessing everything.
console.log("\n# Sanity checks on the calculation itself");
const white = oklchToLinearSrgb(1, 0, 0);
const black = oklchToLinearSrgb(0, 0, 0);
check(
  "white on black computes as 21:1",
  Math.abs(contrastRatio(white, black) - 21) < 0.5,
  contrastRatio(white, black).toFixed(2)
);
check("a colour against itself computes as 1:1", Math.abs(contrastRatio(white, white) - 1) < 0.01);

// Guards the alpha path specifically: 50% white over black must land
// between the two, not at either end.
const halfWhiteOverBlack = composite(
  { color: white, alpha: 0.5 },
  { color: black, alpha: 1 }
);
check(
  "50% white over black composites to a mid grey",
  halfWhiteOverBlack.every((c) => c > 0.4 && c < 0.6),
  halfWhiteOverBlack.map((c) => c.toFixed(2)).join(", ")
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failures.length > 0) {
  console.log("\nFailing pairs:");
  for (const f of failures) console.log(`  - ${f}`);
}
process.exit(failed === 0 ? 0 : 1);
