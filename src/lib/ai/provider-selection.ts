/**
 * Which provider to use, as a pure function of configuration — no
 * imports, so the rule is directly unit-testable rather than only
 * observable through a running app.
 *
 * The rule, in priority order:
 *  1. An explicit AI_PROVIDER=deterministic override always wins, so the
 *     free path can be forced even where a key exists (testing the
 *     fallback; keeping spend at zero).
 *  2. A key present means Claude.
 *  3. Otherwise deterministic — the default, so a fresh checkout works.
 */

export type ProviderName = "claude" | "deterministic";

export function selectProvider(config: {
  apiKey?: string | null;
  override?: string | null;
}): ProviderName {
  if (config.override === "deterministic") return "deterministic";
  if (config.override === "claude") return "claude";
  return config.apiKey ? "claude" : "deterministic";
}
