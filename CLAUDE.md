# Cleaniq Nigeria

The Nigerian version of Cleaniq Services (cleaning company). Kept completely separate from the UK
Cleaniq project at `~/cleaniq` — don't import from or edit the UK repo for Nigeria work (read it for
reference only).

## Layout
- `web/` — Nigeria website: Vite + React 19 + Tailwind CSS 4 (`@tailwindcss/vite`) + Framer Motion + lucide-react.
  Brand colours are Tailwind theme tokens in `web/src/index.css` (`primary`, `primary-dark`, `mint`).
  Run: `cd web && npm run dev` (http://localhost:5173), build: `npm run build`.
- `customer-app/`, `worker-app/` — Nigeria mobile apps (to come; Expo / React Native).

## Working with the owner
- Plain English, short steps, recommend one option. They deploy and push themselves: commit locally, don't push.
- Never ask for secrets in chat; keys go in `.env` files (git-ignored).
- Nigeria specifics: prices in naira (₦), Nigerian cities (Lagos, Abuja, …), Nigerian payment providers.

## Current focus
The landing page for `web/` — built from the reference link/details the owner provides.
