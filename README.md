# Luxury Lehenga Couture

A premium, custom-tailoring e-commerce platform, built module by module against
[`Luxury-Lehenga-Master-Build-Plan.md`](./Luxury-Lehenga-Master-Build-Plan.md) — the project's
source of truth for scope, architecture, and rules. Read that file before starting any new module.

## Stack

Next.js 15 (App Router) · React 18 · TypeScript · Tailwind CSS · shadcn/ui (Base UI) · Supabase
(Postgres, Auth, Storage, RLS) · Framer Motion · Vercel.

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in your Supabase project URL/keys
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment variables

See `.env.example`. `NEXT_PUBLIC_*` values are safe for the browser; `SUPABASE_SERVICE_ROLE_KEY`
must never be exposed client-side and is only used in server-only code.

## Project structure

```text
src/
  app/
    (storefront)/   public site — home, collections, products, builder, etc.
    (auth)/         sign in / sign up
    (account)/      logged-in customer dashboard
    (admin)/        admin dashboard
  components/
    ui/             shadcn primitives
    layout/         header, footer, shells
    shared/         reusable pieces (empty states, etc.)
  lib/
    supabase/       browser/server/middleware Supabase clients
    config/         centralized site config
    logger.ts       logging abstraction
```

See [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) for the reasoning behind these choices.

## Working on this project

Each module is scoped, implemented, and verified independently — see section 13 of the Master
Build Plan for the exact workflow. To start the next module, open a chat and say:

> Start Module 1 from the Master Build Plan.
