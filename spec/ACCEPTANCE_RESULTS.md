# Acceptance Results

> **Run:** 2026-11-26, branch `feature/p6-packaging`, full stack via `docker compose up --build` (Colima, Docker 29, Compose 5.8).
> **How:** the Playwright suite in [`e2e/tests/acceptance.spec.ts`](../e2e/tests/acceptance.spec.ts) in Chromium against the running stack, once per product source, plus the manual checks below. Unit and component tests (`npm test`) cover the detailed rules.
> **Re-run:** `docker compose up --build -d --wait` then `npm run test:e2e` (add `PRODUCT_SOURCE=fixture` for the offline source; set `ENQUIRY_RATE_LIMIT_MAX=100` so repeated runs don't hit the 5-per-15-minutes limit).

## Challenge acceptance criteria

| Criterion | Fake Store | Fixture | Evidence |
|---|---|---|---|
| **Home:** the 5 products chosen as "top rated" are shown | Pass | Pass | E2E "Home…": tiles match `/featured-products` in order; images render via the proxy |
| **Category:** a category link shows top rated, then additional products | Pass | Pass | E2E "Category…": Electronics → 3 top rated + more |
| **Search:** only products matching the term are shown | Pass | Pass | E2E "Search…" (results match the API's matches for "slim fit"; no-results view) |
| **Product:** clicking a tile shows the product details page | Pass | Pass | E2E "Product…": heading, price, Enquire button, tab title |
| **Enquiry:** sales inbox receives an email; customer sees "Thank you" | Pass | Pass | E2E "Enquiry…": exact thank-you text; Mailpit email To `sales@example.com`, Reply-To customer, subject `New enquiry: {title} (ID 1)`, body with message and link |

All 8 E2E tests passed for both sources with **no browser console errors** (so the page CSP blocks nothing the app needs).

## Technical constraints

| Constraint | Result | Evidence |
|---|---|---|
| 1. One client (React web), one backend (Node TS) | Pass | `apps/web`, `apps/api` |
| 2. The browser never calls Fake Store | Pass | All data and images go through `/api/v1`; E2E checks image `src` is `/api/v1/products/{id}/image`; page CSP is `default-src 'self'` and no console errors |
| 3. Infrastructure is AWS-compatible | Pass (designed) | Standard container images; AWS target in ARCHITECTURE §12.2 |
| 4. Reviewer runs it locally, one or two commands | Pass | `docker compose up --build`; no `.env` needed; stack healthy in ~15 s from warm cache (first build is longer: images and npm install) |
| 5. No committed secrets; example env file | Pass | `.env.example` only; `.env` git-ignored and excluded from the Docker build context |
| 6. No paid services or accounts | Pass | Fake Store (free) or offline fixture; Mailpit locally |

## Manual checks (2026-11-26)

| Check | Result |
|---|---|
| Real enquiry through Nginx → email in Mailpit; a `title: "FREE ITEM"` in the request is ignored (A28) | Pass: catalogue title and price in the email |
| Customer email address absent from API logs (A37) | Pass |
| Rate limit through Nginx with a different forged `X-Forwarded-For` on every request (R-07) | Pass: 6th attempt → 429, 5 emails |
| API port not reachable from the host; site and Mailpit bound to 127.0.0.1 only | Pass |
| Unknown `/api/...` path → JSON 404 Problem Details, not the SPA | Pass |
| Deep link `/product/1` and reload served by Nginx | Pass |
| Switch to `PRODUCT_SOURCE=fixture` without rebuilding | Pass |
| API run with `npm run dev:api` sends to the Docker Mailpit (`SMTP_HOST=127.0.0.1`) | Pass |

## Not covered here

- Visual review in a real browser by a person (layout, look). Automated checks only.
- AWS deployment: designed, not built (DECISIONS §9).
