/**
 * Refuses to run a destructive seeder against the production database.
 *
 * WHY THIS EXISTS — the incident, written down so the reasoning survives.
 *
 * Running `run-suite.mjs` before a deployment wiped the live shop. The
 * chain was:
 *
 *   run-suite.mjs
 *     -> test-seed-demo.mjs        (asserts --clear is safe)
 *       -> seed-demo.mjs --clear   (deletes everything in demo_seed_items)
 *
 * `--clear` did exactly what it promises. The mistake was upstream: the
 * collection seeders recorded their Storage uploads in the SAME
 * `demo_seed_items` manifest, so `--clear` treated 50 product photographs
 * as its own and deleted the objects. The database rows survived pointing
 * at URLs that now returned 400, and because local development and the
 * Vercel deployment share one Supabase project, the live site broke the
 * moment the test ran.
 *
 * WHY THE GUARD KEYS ON THE DATABASE, NOT `NEXT_PUBLIC_SITE_URL`.
 *
 * This is the important part. At the time of the incident `.env.local`
 * held:
 *
 *   NEXT_PUBLIC_SITE_URL=http://localhost:3000     <- looks like dev
 *   NEXT_PUBLIC_SUPABASE_URL=https://<prod>...     <- IS production
 *
 * A site-URL check would have passed happily and the shop would still
 * have been wiped. What is destroyed is rows and objects, so the only
 * signal that means anything is which project those rows live in.
 *
 * HOW TO GET PAST IT, deliberately awkward:
 *
 *   ALLOW_DESTRUCTIVE=1 node --env-file=.env.local scripts/seed-demo.mjs --clear
 *
 * The right fix is a separate Supabase project for development and
 * testing — tracked as a required task in Module 32. Until that exists,
 * every run of these scripts is a run against production, and this guard
 * makes that impossible to do by accident.
 */

/**
 * The project ref that serves the live site.
 *
 * Overridable so this file does not have to change when the production
 * project does. Set PRODUCTION_SUPABASE_REF in the environment once the
 * dev/prod split of Module 32 exists; the default is the project that was
 * live when this guard was written.
 */
const PRODUCTION_REF = process.env.PRODUCTION_SUPABASE_REF ?? "cmskqksbumvastgoacmu";

/** Pulls the project ref out of a Supabase URL. */
export function projectRef(url = process.env.NEXT_PUBLIC_SUPABASE_URL) {
  const match = /^https?:\/\/([a-z0-9]+)\.supabase\./i.exec(url ?? "");
  return match?.[1] ?? null;
}

/** True when the configured database is the one serving the live site. */
export function isProductionDatabase() {
  return projectRef() === PRODUCTION_REF;
}

/**
 * Call before anything that deletes or overwrites seeded data.
 *
 * Exits non-zero with an explanation rather than throwing, so a caller
 * that shells out sees a clean failure instead of a stack trace.
 *
 * @param {string} operation  e.g. "--clear" — named in the message
 * @param {{ soft?: boolean }} [options]  soft:true returns false instead
 *        of exiting, for callers that would rather skip than die
 */
export function guardDestructive(operation, { soft = false } = {}) {
  if (!isProductionDatabase()) return true;
  if (process.env.ALLOW_DESTRUCTIVE === "1") {
    console.log(
      `! ${operation} is running against the PRODUCTION database ` +
        `(${projectRef()}) because ALLOW_DESTRUCTIVE=1 is set.`
    );
    return true;
  }

  const message = [
    "",
    `REFUSED: ${operation} targets the production database (${projectRef()}).`,
    "",
    "  This script deletes or overwrites seeded content, and this project",
    "  serves the live site. Running it here has already taken the shop",
    "  down once — see scripts/lib/guard-destructive.mjs for what happened.",
    "",
    "  If you genuinely mean it:",
    "",
    `    ALLOW_DESTRUCTIVE=1 node --env-file=.env.local <script> ${operation}`,
    "",
    "  The real fix is a separate Supabase project for development and",
    "  testing. That is a required task in Module 32.",
    "",
  ].join("\n");

  if (soft) {
    console.log(message);
    return false;
  }
  console.error(message);
  process.exit(1);
}
