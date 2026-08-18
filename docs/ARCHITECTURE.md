# Architecture

Quick reference for how this codebase is organized. For the full product roadmap, see
[`../Luxury-Lehenga-Master-Build-Plan.md`](../Luxury-Lehenga-Master-Build-Plan.md).

## Route groups

`src/app` is split into four route groups that map to the four audiences of the platform:

- `(storefront)` — public marketing/shopping site, wrapped in `SiteHeader`/`SiteFooter`.
- `(auth)` — sign in / sign up / password reset, centered minimal shell.
- `(account)` — logged-in customer dashboard (Module 2+).
- `(admin)` — admin dashboard (Module 16+).

Route protection (redirecting unauthenticated users away from `(account)`/`(admin)`) is added in
Module 2, once Supabase Auth is implemented. `middleware.ts` currently only refreshes the Supabase
session cookie on every request.

## `lib/` layering

- `lib/supabase/` — the only place Supabase clients are constructed. `client.ts` for Client
  Components, `server.ts` for Server Components/Actions, `middleware.ts` for the session-refresh
  helper used by root `middleware.ts`.
- `lib/config/` — centralized, typed config (brand name, description, URL) so components never
  hardcode brand strings. Values here are developer defaults until Admin-configurable settings
  ship in Module 3/25.
- `lib/logger.ts` — thin logging wrapper so server code never leaks raw errors to the client;
  swap the implementation for a real provider later without touching call sites.

## Provider abstractions

Per the Master Build Plan's free-first policy, payments, notifications, shipping, and AI are each
built behind a provider interface with a mock/free implementation during development, so a real
provider can be swapped in later without changing calling code. These land in their respective
modules (11, 15, 14, 22) — nothing is implemented yet.

## Theming

All colors, radii, and fonts are CSS variables defined in `src/app/globals.css` and mapped into
Tailwind's theme in `tailwind.config.ts` — components should always use the semantic Tailwind
classes (`bg-primary`, `text-muted-foreground`, etc.), never raw color values, so the palette can
become Admin-configurable later without touching component code.
