/**
 * Tax and deposit arithmetic (Module 25 Pass 2).
 *
 * NO IMPORTS on purpose, like `format.ts` and `registry.ts` — this is
 * money maths, so it is the part most worth unit-testing directly, and
 * `scripts/test-settings-pass2.mjs` imports the `.ts` under Node's type
 * stripping.
 *
 * Both rules default to OFF (0%), and at 0% every function here returns
 * exactly what the caller passed in — so upgrading changes no totals
 * until an admin opts in. Silently starting to charge tax, or splitting
 * a customer's payment in two, would be unacceptable behaviour for an
 * upgrade.
 */

/** Rounds to whole pence. Money maths must never carry float drift into a stored total. */
export function toPence(amount: number): number {
  return Math.round(amount * 100) / 100;
}

export type TaxResult = {
  /** The tax portion, for display and for orders.tax_amount. */
  taxAmount: number;
  /** What the customer actually pays. */
  total: number;
  /** The amount before tax, for the checkout breakdown. */
  net: number;
};

/**
 * @param taxableAmount value after discounts, before tax
 * @param ratePercent   e.g. 20 for 20%. 0 disables tax entirely.
 * @param inclusive     true when listed prices ALREADY contain the tax
 *
 * Exclusive: tax is added on top, so the customer pays more.
 * Inclusive: the total is unchanged and the tax is extracted from it for
 * the breakdown — the standard UK retail presentation.
 */
export function calculateTax(
  taxableAmount: number,
  ratePercent: number,
  inclusive: boolean
): TaxResult {
  const base = toPence(Math.max(0, taxableAmount));
  if (!ratePercent || ratePercent <= 0) {
    return { taxAmount: 0, total: base, net: base };
  }

  const rate = ratePercent / 100;

  if (inclusive) {
    // The tax already inside `base`: base = net * (1 + rate).
    const net = toPence(base / (1 + rate));
    return { taxAmount: toPence(base - net), total: base, net };
  }

  const taxAmount = toPence(base * rate);
  return { taxAmount, total: toPence(base + taxAmount), net: base };
}

export type DepositResult = {
  /** Charged up front. Equals `total` when no deposit rule applies. */
  depositAmount: number;
  /** Owed later. Zero when the full amount is taken up front. */
  balanceAmount: number;
  /** Whether to create a 'deposit' payment rather than a 'full' one. */
  usesDeposit: boolean;
};

/**
 * @param total          the order total
 * @param percent        e.g. 50 for half up front. 0 charges the full amount.
 *
 * Guards both ends: a percentage of 0 or less takes the full amount, and
 * one of 100 or more also takes the full amount rather than creating a
 * "deposit" equal to the total plus a zero balance, which would be a
 * confusing way to say "pay in full".
 */
export function calculateDeposit(total: number, percent: number): DepositResult {
  const amount = toPence(Math.max(0, total));
  if (!percent || percent <= 0 || percent >= 100) {
    return { depositAmount: amount, balanceAmount: 0, usesDeposit: false };
  }

  const depositAmount = toPence(amount * (percent / 100));
  // Subtract rather than compute independently, so the two always sum to
  // the total exactly — computing both from the percentage can leave a
  // penny unaccounted for after rounding.
  const balanceAmount = toPence(amount - depositAmount);
  return { depositAmount, balanceAmount, usesDeposit: depositAmount > 0 && balanceAmount > 0 };
}
