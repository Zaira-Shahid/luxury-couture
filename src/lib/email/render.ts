/**
 * Pure email rendering. NO IMPORTS on purpose — like guardrails.ts,
 * faq-matching.ts and query-intent.ts, this is the piece worth testing
 * exhaustively, and scripts/test-email.mjs imports it directly under
 * Node's type stripping. Path aliases (`@/...`) do not resolve there, so
 * anything needing site settings lives in layout.ts instead.
 *
 * The HTML here is deliberately old-fashioned — nested tables, inline
 * styles, a 600px fixed width, no flexbox or grid. That is not
 * carelessness: Outlook renders through Word's engine, and modern CSS
 * layout simply does not work there. These are the constructions that
 * survive the major clients.
 *
 * buildMarketingEmail() REQUIRES an unsubscribe URL and appends the
 * opt-out footer itself. That is what makes "every marketing email has a
 * working unsubscribe link" true by construction rather than by
 * remembering — see provider.ts on why.
 */

export type EmailBrand = {
  name: string;
  logoUrl: string | null;
  accent: string;
  contactEmail: string | null;
  footerText: string | null;
};

/** Escapes interpolated content. Template copy is ours, but order numbers and names are not. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export type EmailBody = {
  heading: string;
  /** Paragraphs of plain text. Escaped and wrapped by the layout. */
  paragraphs: string[];
  cta?: { label: string; url: string };
};

function renderParagraphs(paragraphs: string[]): string {
  return paragraphs
    .map(
      (paragraph) =>
        `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#3d3d3d;">${escapeHtml(
          paragraph
        )}</p>`
    )
    .join("");
}

function renderCta(cta: EmailBody["cta"], accent: string): string {
  if (!cta) return "";
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 8px;">
  <tr><td style="border-radius:6px;background:${accent};">
    <a href="${escapeHtml(cta.url)}" style="display:inline-block;padding:12px 24px;font-size:15px;color:#ffffff;text-decoration:none;">${escapeHtml(cta.label)}</a>
  </td></tr>
</table>`;
}

function shell(brand: EmailBrand, inner: string, footer: string): string {
  const header = brand.logoUrl
    ? `<img src="${escapeHtml(brand.logoUrl)}" alt="${escapeHtml(brand.name)}" width="140" style="display:block;border:0;max-width:140px;height:auto;" />`
    : `<span style="font-family:Georgia,'Times New Roman',serif;font-size:22px;color:#1a1a1a;">${escapeHtml(brand.name)}</span>`;

  return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${escapeHtml(brand.name)}</title>
</head>
<body style="margin:0;padding:0;background:#faf9f6;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#faf9f6;">
  <tr><td align="center" style="padding:32px 16px;">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:100%;background:#ffffff;border-radius:8px;">
      <tr><td style="padding:28px 32px 8px;">${header}</td></tr>
      <tr><td style="padding:8px 32px 24px;">${inner}</td></tr>
      <tr><td style="padding:0 32px 28px;border-top:1px solid #ececec;">
        <div style="padding-top:16px;font-size:12px;line-height:1.6;color:#8a8a8a;">${footer}</div>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

function baseFooter(brand: EmailBrand): string {
  const contact = brand.contactEmail
    ? `Questions? Reply to this email or write to <a href="mailto:${escapeHtml(brand.contactEmail)}" style="color:#8a8a8a;">${escapeHtml(brand.contactEmail)}</a>.<br />`
    : "";
  const legal = brand.footerText
    ? escapeHtml(brand.footerText)
    : `&copy; ${new Date().getFullYear()} ${escapeHtml(brand.name)}.`;
  return `${contact}${legal}`;
}

function renderText(body: EmailBody, brand: EmailBrand, unsubscribeUrl?: string): string {
  const lines = [body.heading, "", ...body.paragraphs];
  if (body.cta) lines.push("", `${body.cta.label}: ${body.cta.url}`);
  lines.push("", "—", brand.name);
  if (brand.contactEmail) lines.push(brand.contactEmail);
  if (unsubscribeUrl) {
    lines.push("", `Don't want these emails? Unsubscribe: ${unsubscribeUrl}`);
  }
  return lines.join("\n");
}

export type RenderedEmail = { html: string; text: string };

/**
 * Transactional: order updates, payment receipts, shipping notices.
 * Carries NO unsubscribe link — these are not marketing, and inviting
 * someone to opt out of their own order updates would be wrong.
 */
export function buildTransactionalEmail(brand: EmailBrand, body: EmailBody): RenderedEmail {
  const inner = `<h1 style="margin:0 0 16px;font-family:Georgia,'Times New Roman',serif;font-size:22px;line-height:1.3;color:#1a1a1a;font-weight:normal;">${escapeHtml(body.heading)}</h1>
${renderParagraphs(body.paragraphs)}${renderCta(body.cta, brand.accent)}`;

  return {
    html: shell(brand, inner, baseFooter(brand)),
    text: renderText(body, brand),
  };
}

/**
 * Marketing: campaigns, abandoned-cart recovery, anything promotional.
 * The unsubscribe URL is a required argument and the footer is appended
 * here, so a marketing email without a working opt-out cannot be built.
 */
export function buildMarketingEmail(
  brand: EmailBrand,
  body: EmailBody,
  unsubscribeUrl: string
): RenderedEmail {
  const inner = `<h1 style="margin:0 0 16px;font-family:Georgia,'Times New Roman',serif;font-size:22px;line-height:1.3;color:#1a1a1a;font-weight:normal;">${escapeHtml(body.heading)}</h1>
${renderParagraphs(body.paragraphs)}${renderCta(body.cta, brand.accent)}`;

  const footer = `${baseFooter(brand)}<br /><br />
You're receiving this because you asked to hear from us.
<a href="${escapeHtml(unsubscribeUrl)}" style="color:#8a8a8a;text-decoration:underline;">Unsubscribe</a>.`;

  return {
    html: shell(brand, inner, footer),
    text: renderText(body, brand, unsubscribeUrl),
  };
}

