/**
 * MODULE 28: the app had exactly one loading.tsx, at the root, which
 * renders a full-screen spinner — so every navigation inside the account
 * area blanked the whole page including the nav the user just clicked.
 *
 * A route-group loading file keeps the shell (header, account nav) on
 * screen and only skeletons the panel that is actually being fetched.
 * That is the difference between "the app is thinking" and "the app
 * disappeared", and it costs nothing at runtime.
 */
export default function AccountLoading() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading…</span>
      <div className="h-8 w-48 animate-pulse rounded-lg bg-muted" />
      <div className="h-32 animate-pulse rounded-xl bg-muted" />
      <div className="h-32 animate-pulse rounded-xl bg-muted" />
    </div>
  );
}
