/**
 * Same reasoning as the account area's loading file: keep the admin
 * shell and sidebar on screen while a panel loads, rather than replacing
 * the entire page with the root spinner.
 */
export default function AdminLoading() {
  return (
    <div className="flex flex-col gap-4 p-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading…</span>
      <div className="h-8 w-56 animate-pulse rounded-lg bg-muted" />
      <div className="h-64 animate-pulse rounded-xl bg-muted" />
    </div>
  );
}
