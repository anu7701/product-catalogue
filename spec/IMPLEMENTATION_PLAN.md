# Implementation Plan — Product Catalogue PoC

> **Status:** v2 — validation now built with its first consumer, not as a separate phase
> **Based on:** [FUNCTIONAL_SPEC.md](./FUNCTIONAL_SPEC.md), [ARCHITECTURE.md](./ARCHITECTURE.md) (v2), [DECISIONS.md](../DECISIONS.md)
> **Branch:** all work on `feature/product-catalogue`; PR into `main` raised in Phase 7 and left open.
> Feature IDs (`HOM-01`), assumption IDs (`A4`, `NEW-46`), technical decisions (`T13`) and review items (`R-04`) refer to those documents.

---

## 0. How to use this plan

### 0.1 Task conventions

- **Task ID** `P<phase>.<n>` (e.g. `P3.4`). One task ≈ one small commit/PR-reviewable change, implementable and testable on its own.
- **Size:** **S** ≈ < 20 min with AI assistance, **M** ≈ 20–45 min. No task is larger; anything bigger is split.
- **Tier** (from the functional spec): **P0** must ship · **P1** should ship · **P2** cut first if over the time-box.
- **Lane** marks what can run in parallel (§1.2).
- Every task's tests are named with the feature ID they cover (e.g. `CAT-01: ties broken by rating count`).
- **Validation is built with its first consumer.** Schemas still live in `packages/shared` (one definition for browser and server, A29, T9), but each is written and tested in the task that first needs it, not up front. Later tasks import it, never redefine it. Whichever lane reaches it first writes it.

### 0.2 Definition of done — applies to every task

1. Code matches the referenced spec IDs; any deviation is recorded in DECISIONS.md.
2. Lint, format and typecheck pass for the touched package.
3. Tests listed for the task exist and pass; no live network calls in tests.
4. AI-generated code reviewed line by line; anything surprising noted for AI_USAGE.md.
5. One focused commit with a descriptive message, pushed to the feature branch.

### 0.3 Open decisions that affect the plan

These are still open in [SPEC_REVIEW.md](./SPEC_REVIEW.md). The plan does not wait for them: each is **isolated in one function** so the decision is a one-line change and its test.

| Decision | Affects task | Default if still undecided when the task starts |
|---|---|---|
| **R-04** — top rated count vs "additional products" AC (NEW-21) | P3.4 | Implement current spec (BR3/BR8) behind a single `topRatedCount(categorySize)` rule |
| **R-08** — final tie-break with string IDs (NEW-19) | P3.4 | Data source order (stable sort) — works for any ID format; flag in DECISIONS |
| **R-09** — category slugs vs raw names (NEW-22, NEW-23) | P2.3, P3.3 | Raw name, case-insensitive match (current spec) behind a single `categoryKey()` function |

---

## 1. Overview

### 1.1 Phases

| Phase | Goal | Depends on | Tier |
|---|---|---|---|
| **P0** Foundations | Monorepo, tooling, agent instructions | — | P0 |
| **P1** Shared data types | Product/Category types and response shapes only (no validation) | P0 | P0 |
| **P2** API platform | Config, ports, both product sources, HTTP skeleton | P1 | P0 |
| **P3** API features | Services + routes for every feature | P2 | P0/P1 |
| **P4** Web platform | App shell, API client, shared UI, header | P1 | P0 |
| **P5** Web features | Pages and enquiry journey | P4 (+ P3 for manual check) | P0/P1 |
| **P6** Packaging & integration | Docker, compose, Mailpit, E2E | P3, P5 | P0 (E2E: P2) |
| **P7** Delivery | README, AI_USAGE, DECISIONS, PR | P6 | P0 |

### 1.2 Parallel lanes

```
P0 ─► P1 ─┬─► P2 ─► P3 ─────────────┐   API lane
          │                         ├─► P6 ─► P7
          └─► P4 ─► P5 ─────────────┘   Web lane (mocks API with MSW from the shared contract)
```

- **API lane and Web lane run in parallel after P1.** The shared data types (P1) are the hand-off: the web lane mocks the API with MSW using the same types, so it never waits for real endpoints.
- **Validation sync points:** the search-term schema (written in P3.6) is reused by P4.6, and the enquiry schema (written in P3.9) by P5.5. If the web lane gets there first, it writes the schema in `shared` and the API task reuses it.
- **Within a phase**, tasks marked with the same lane letter (e.g. `A`, `B`) have no dependency on each other and can be done in parallel (separate AI sessions/worktrees).
- **P6 Docker tasks** can start as soon as P2.6 (API boots) and P4.1 (web builds) exist.

### 1.3 Critical path (minimum to meet all acceptance criteria)

P0.1 → P1.1 → P2.1 → P2.2 → P2.3 → P2.6 → P3.1 → P3.7 → P3.9 → P4.1 → P4.3 → P5.4 → P5.5 → P6.3 → P7.1

---

## Phase P0 — Foundations

**Goal:** A repository where every later task can be built, linted and tested with one command, and where AI tools get consistent instructions.
**Dependencies:** none.
**Features:** none directly (enables all).

| ID | Task | Size | Lane | Depends on |
|---|---|---|---|---|
| P0.1 | Create npm workspaces root: `apps/web`, `apps/api`, `packages/shared`, each with its own `package.json` (A39, ARCH §1) | S | — | — |
| P0.2 | Shared TypeScript base config (strict) + per-package `tsconfig` | S | A | P0.1 |
| P0.3 | ESLint + Prettier config shared across packages; root scripts `lint`, `format`, `typecheck` | S | A | P0.1 |
| P0.4 | Vitest set up in all three packages; root `test` script runs all | S | A | P0.1 |
| P0.5 | `CLAUDE.md` agent instructions: architecture rules (ARCH §14), layering, testing conventions, "no code outside the plan", spec-ID test naming | S | B | — |
| P0.6 | `.env.example` skeleton listing every setting from ARCH §3.7 with safe defaults (constraint 5) | S | B | — |

**Expected outputs:** buildable empty packages; `npm install`, `npm run lint`, `npm run typecheck`, `npm test` all succeed from the root; `CLAUDE.md`; `.env.example`.
**Testing requirements:** one placeholder test per package proves the runner works (removed later).
**Definition of done:** a fresh clone runs `npm install && npm test` green; CLAUDE.md committed.

---

## Phase P1 — Shared data types (`packages/shared`)

**Goal:** The data shapes both lanes need on day one so they can work in parallel. **No validation rules here.** Each validation schema is written with its first consumer (§0.1): error codes in P2.7, search term in P3.6, enquiry in P3.9.
**Dependencies:** P0.
**Features:** data shapes for all modules.

| ID | Task | Size | Lane | Depends on |
|---|---|---|---|---|
| P1.1 | `Product`, `Category`, `Rating` types (string IDs A4a; rating nullable NEW-07) and response shapes: `{items}`, category page `{category, topRated, more}`, search `{query, items}` (ARCH §6.2) | S | — | P0 |

**Expected outputs:** `@catalogue/shared` exporting data types; importable from both apps.
**Testing requirements:** none beyond typecheck. The types are exercised by the adapter contract tests (P2.5) and MSW handlers (P4.3).
**Definition of done:** both apps compile against the package; no app-specific code in `shared`.

---

## Phase P2 — API platform (`apps/api`)

**Goal:** A running API with validated config, both product sources behind one port, and the HTTP cross-cutting concerns (errors, logging, security) in place — before any feature logic.
**Dependencies:** P1.
**Features:** CFG-01 (parsing), CFG-02 (validation), GLB-03 error semantics (502 vs 404), constraint 2, T3, T13.

| ID | Task | Size | Lane | Depends on |
|---|---|---|---|---|
| P2.1 | Config module: load env, Zod-validate, fail fast on invalid/missing critical settings (NEW-48); featured ID normalisation — trim, drop empties, dedupe, cap 5, warnings (CFG-01 BR3–BR7, NEW-45/46) | M | A | P1 |
| P2.2 | Ports: `ProductSource`, `Notifier`, `EnquiryRecorder` interfaces; domain errors (`ProductNotFound`, `CategoryNotFound`, `ProductUnavailable`, `UpstreamUnavailable`, `EmailDeliveryFailed`) | S | A | P1 |
| P2.3 | `FixtureProductSource` + committed `products.json` snapshot (20 products) + local placeholder images; validated at startup (ARCH §3.6) | M | B | P2.2 |
| P2.4 | `FakeStoreProductSource`: list, get by id (empty-body → not found), categories; 5s timeout; Zod validation, drop malformed records (NEW-09, NEW-10); maps to our `Product` shape (ARCH §3.2) | M | C | P2.2 |
| P2.5 | `ProductSource` **contract test suite** run against both adapters (ARCH §14.2 #15) | S | — | P2.3, P2.4 |
| P2.6 | Fastify app factory + composition root selecting adapters by `PRODUCT_SOURCE`; `/api/v1/health` | S | A | P2.1, P2.2 |
| P2.7 | Central error handler → Problem Details; request ID; no internals leaked (ARCH §8.2). **Writes in `shared`:** Problem Details schema, error code enum (ARCH §8.1) and the customer-facing message for each code | M | D | P2.6 |
| P2.8 | Logging: pino JSON, request ID, PII redaction paths, named events (ARCH §9.1) | S | D | P2.6 |
| P2.9 | Security plugins: helmet/CSP, body size limit, `Cache-Control: no-store` default, no CORS (ARCH §10.1) | S | D | P2.6 |

**Expected outputs:** `npm run dev` starts the API; `/api/v1/health` returns 200; switching `PRODUCT_SOURCE` swaps data with no other change.
**Testing requirements:**
- P2.1: missing/invalid `SALES_INBOX` → startup error; `"3, 7 ,,12,3"` → `[3,7,12]` + warning; > 5 IDs capped; unset featured → empty + warning.
- P2.4: MSW-recorded Fake Store responses — mapping, missing rating → `null`, malformed record dropped, timeout → `UpstreamUnavailable`, empty body → not found.
- P2.5: same suite (list, get by id, unknown id, categories) green for both adapters.
- P2.7: thrown domain errors map to the right status/code and a body that passes the shared Problem Details schema; every error code has a message; 500 body contains no stack trace.
- P2.8: enquiry-shaped body logged with name/email/phone/message redacted.

**Definition of done:** API boots with either source; contract suite green for both; error/logging/security behaviour covered by `inject()` tests.

---

## Phase P3 — API features

**Goal:** Every business rule implemented once, in services, and exposed through the agreed routes (ARCH §3.4, §6.2).
**Dependencies:** P2. Services are tested with `FixtureProductSource` + in-memory `RecordingNotifier`.
**Features:** HOM-01, HOM-02, CAT-01, CAT-02, SRC-01–03, PRD-01, PRD-02, ENQ-02–06, CFG-01, CFG-02.

| ID | Task | Size | Lane | Depends on |
|---|---|---|---|---|
| P3.1 | `CatalogueService.featured`: configured order, skip missing + `featured.id_missing` warning, never pad (HOM-01, A3, A4, NEW-17) | S | A | P2 |
| P3.2 | Route `GET /api/v1/featured-products` | S | A | P3.1 |
| P3.3 | `CatalogueService.categories`: alphabetical, display labels (NEW-02, NEW-03); route `GET /api/v1/categories` | S | B | P2 |
| P3.4 | `CatalogueService.categoryPage`: filter, rank (avg desc → count desc → tie-break per §0.3), top N, unrated → more, no duplicates, unknown → `CategoryNotFound` (CAT-01, CAT-02) | M | B | P2 |
| P3.5 | Route `GET /api/v1/categories/{category}/products` (404 vs 502) | S | B | P3.4 |
| P3.6 | `SearchService`: case-insensitive literal substring over title/description/category, source order (SRC-02, A12, NEW-27); route `GET /api/v1/products?q=`. **Writes in `shared`:** search-term schema — trim, 1–100 chars, literal (SRC-01 BR2–4, NEW-24) | M | C | P2 |
| P3.7 | Route `GET /api/v1/products/{id}` (PRD-01, PRD-02) | S | C | P2 |
| P3.8 | Image proxy `GET /api/v1/products/{id}/image`: look up by id, allow-listed host only, `image/*` only, size cap, timeout; fixture serves local files (ARCH §10.3) | M | D | P2 |
| P3.9 | `EnquiryService`: validate → look up product (from source, never request) → record (no-op) → notify; `ProductUnavailable` if missing (ENQ-03, A28, A34, NEW-36). **Writes in `shared`:** enquiry schema — trim, required, lengths, email format, phone charset, no CR/LF, unknown fields stripped (ENQ-02, NEW-31–34) — and field error messages (ENQ-02.FR2) | M | E | P2 |
| P3.10 | `SmtpNotifier`: compose email per ENQ-03.FR1 (To, From, Reply-To, subject, plain-text body incl. price + product link + UTC time) | S | E | P2 |
| P3.11 | Route `POST /api/v1/enquiries` → `202`; 400/422/502 mapping; rate limit 5/15 min per IP with correct proxy trust, every attempt counts (ENQ-06, NEW-43/44) | M | E | P3.9, P3.10 |

**Expected outputs:** all endpoints in ARCH §6.2 working against both product sources; enquiry email visible in Mailpit when run locally.
**Testing requirements:**
- P3.1: order preserved; stale ID skipped + warned; all stale → empty.
- P3.4: tie-break example from CAT-01 AC (A 4.5/100, B 4.5/300, C, D → B, A, C / D); every product appears exactly once; unrated never in top rated; unknown category → error; 4-product category split.
- P3.6: search-term schema — empty, whitespace-only, 100 vs 101 chars, special characters kept; route returns 400 for missing/empty/too long `q`; every row of the SRC-02 edge-case table (`BACKPACK`, `pack`, `men's` → women's clothing too, `jewelry`, `slim fit`, `electronics`, `.*`).
- P3.7/P3.5: 404 vs 502 when the source is down (failing fake adapter).
- P3.8: non-allow-listed host refused; non-image content type refused.
- P3.9: enquiry schema — table-driven tests for every ENQ-02 rule and edge case (whitespace-only name, uppercase email, `Zoë O'Brien`, CR/LF in name/email, 101-char name, 1001-char message, extra fields stripped); product details come from the source even if the request carries a title; missing product → `ProductUnavailable`; notifier failure → `EmailDeliveryFailed`; recorder called before notifier.
- P3.10: message fields exact (subject format, Reply-To = customer, "Not provided"/"No message" defaults, plain text only).
- P3.11: 202 on success; 400 with field errors; 6th request → 429; spoofed `X-Forwarded-For` does not change the rate-limit key; no PII in logs.

**Definition of done:** every P0/P1 API rule in the functional spec has a passing test named with its feature ID; no business logic in routes or adapters.

---

## Phase P4 — Web platform (`apps/web`)

**Goal:** App shell, routing, API access and shared UI so pages are thin compositions.
**Dependencies:** P1 (types). Runs **in parallel with P2/P3**, mocking the API with MSW.
**Features:** GLB-01, GLB-02, GLB-03, GLB-04, GLB-05 (foundations), CFG-04 (tokens).

| ID | Task | Size | Lane | Depends on |
|---|---|---|---|---|
| P4.1 | Vite + React + TS app; React Router with routes from ARCH §2.3 incl. `*` not-found; TanStack Query provider (refetch on mount, GET retry once, no POST retry) | S | — | P1 |
| P4.2 | Theme: `tokens.css` (colours, fonts, spacing), store name from build-time setting, focus styles, contrast check (A40, NEW-16) | S | A | P4.1 |
| P4.3 | API client module: only place with URLs; parses Problem Details into typed errors (ARCH §2.2, §8.2) + MSW handlers built from shared types | M | B | P4.1 |
| P4.4 | `PageState` (loading / empty / error with Try again), `NotFound` view (GLB-03, GLB-04) | S | A | P4.1 |
| P4.5 | `ProductTile` + `ProductGrid`, `Price` (USD, 2 dp), `Rating` (`3.9 (120)`), image placeholder on error, alt text (GLB-02, NEW-04–08) | M | C | P4.1 |
| P4.6 | `Header`: store name → home, category links, `SearchBar` (button + Enter, empty hint, pre-filled from URL) (GLB-01, SRC-01, NEW-25). **Reuses** the shared search-term schema from P3.6 for trim/empty/100-char rules (writes it first if P3.6 isn't done) | M | B | P4.3 |
| P4.7 | Top-level error boundary + document title helper | S | A | P4.1 |

**Expected outputs:** shell renders on every route with header; components render against MSW data.
**Testing requirements:** RTL tests — `PageState` Try again calls refetch; tile renders price/rating/placeholder and links to `/product/{id}`; search bar empty-hint, Enter submits, special characters preserved in URL; API client maps a Problem Details 404/502 to the right typed error.
**Definition of done:** shell + components tested; no page fetches outside the API client; keyboard focus visible on all interactive elements.

---

## Phase P5 — Web features

**Goal:** Every customer journey from the functional spec, end to end in the browser.
**Dependencies:** P4. Developed against MSW; verified manually against the real API once P3 lands.
**Features:** HOM-01, HOM-02, CAT-01, CAT-02, SRC-02, SRC-03, PRD-01, PRD-02, ENQ-01–06.

| ID | Task | Size | Lane | Depends on |
|---|---|---|---|---|
| P5.1 | `HomePage`: featured section (hidden when empty, NEW-17) + "Shop by category" (HOM-01, HOM-02) | S | A | P4 |
| P5.2 | `CategoryPage`: heading, "Top rated in…", "More in…", not-found vs error (CAT-01, CAT-02) | S | A | P4 |
| P5.3 | `SearchPage`: heading + count, results, no-results with links, empty/over-long term messages (SRC-02, SRC-03, NEW-26) | S | B | P4 |
| P5.4 | `ProductPage`: all fields, category link, Enquire button, not-found vs error, tab title (PRD-01, PRD-02, NEW-28, NEW-29) | S | C | P4 |
| P5.5 | `EnquiryForm`: inline on product page, fields + labels, focus first field, keep input on close (ENQ-01, ENQ-02, NEW-30, NEW-35). Client validation **reuses** the shared enquiry schema and messages from P3.9 (writes them first if P3.9 isn't done) | M | C | P5.4 (+ P3.9 schema) |
| P5.6 | Submission states: "Sending…" + disabled button; Thank-you replaces form (only on 202); error messages for 400/422/429/502 keeping input; screen-reader announcements (ENQ-03–06, NEW-14, NEW-38, NEW-40, NEW-41) | M | C | P5.5 |

**Expected outputs:** all journeys usable against MSW and against the running API.
**Testing requirements:** RTL + MSW per page — featured order, hidden section, category split rendering, not-found vs error, search count/no-results, product fields; enquiry: field errors shown and input kept, button disabled while sending, Thank-you only after 202, 502/429/422 messages, no automatic resubmission.
**Definition of done:** every P0 acceptance criterion in the functional spec demonstrable in the browser; keyboard-only enquiry journey works (GLB-05 AC).

---

## Phase P6 — Packaging & integration

**Goal:** The reviewer runs everything with one command in under 10 minutes, with or without internet (constraint 4, T13).
**Dependencies:** P3 and P5 for full integration; P6.1/P6.2 can start once P2.6 and P4.1 exist.
**Features:** CFG-02, CFG-03; constraints 4–6.

| ID | Task | Size | Lane | Depends on |
|---|---|---|---|---|
| P6.1 | API Dockerfile: multi-stage, workspace-aware (repo-root build context), non-root user | S | A | P2.6 |
| P6.2 | Web Dockerfile: build SPA → Nginx; SPA fallback; `/api/*` proxied to api and **never** falls back to `index.html` | S | B | P4.1 |
| P6.3 | `docker-compose.yml`: web (8080), api (internal), Mailpit (8025 UI); defaults inside compose so no `.env` is required; health checks | S | — | P6.1, P6.2 |
| P6.4 | Finalise `.env.example` with defaults matching compose; fixture switch documented | S | C | P6.3 |
| P6.5 | Manual acceptance pass: run every functional-spec AC against the stack with `PRODUCT_SOURCE=fakestore` and `=fixture`; log results | M | — | P6.3, P3, P5 |
| P6.6 | **(P2)** Playwright E2E: home → category → product → enquiry → assert email via Mailpit API, using fixture source | M | D | P6.3 |
| P6.7 | **(P2)** GitHub Actions CI: install → lint → typecheck → test → docker build | S | D | P0 |

**Expected outputs:** `docker compose up --build` → site on `localhost:8080`, mailbox on `localhost:8025`; works offline with the fixture source.
**Testing requirements:** P6.5 checklist complete for both sources; P6.6 green locally (and in CI if P6.7 done).
**Definition of done:** a fresh clone on a clean machine runs in < 10 minutes following only the README; enquiry email visible in Mailpit.

---

## Phase P7 — Delivery

**Goal:** Submission artefacts the challenge assesses, accurate to what was built.
**Dependencies:** P6.
**Features:** none (deliverables).

| ID | Task | Size | Lane | Depends on |
|---|---|---|---|---|
| P7.1 | README: what it is, stack choice + why, prerequisites (Docker/Compose version, free ports, internet or fixture), one-command run, Mailpit URL (NEW-49), config table, how to run tests, dev mode | M | A | P6 |
| P7.2 | DECISIONS.md: update open items (R-04, R-08, R-09 outcomes), cut list for anything dropped during the build, next steps, **time spent** (planning / building / testing / reviewing) | S | B | P6 |
| P7.3 | AI_USAGE.md: tools/models, CLAUDE.md, link to `spec/`, 3–5 key prompts/moments, where the AI was wrong and how it was caught | S | B | P6 |
| P7.4 | Raise PR `feature/product-catalogue` → `main`: summary, how to review/run, decisions & trade-offs, what was cut, testing evidence; leave open | S | — | P7.1–P7.3 |
| P7.5 | Add reviewers as collaborators on the private repo | S | — | P7.4 |

**Expected outputs:** open PR with a complete description; README, DECISIONS.md, AI_USAGE.md at repo root.
**Testing requirements:** follow the README from a fresh clone once more before raising the PR.
**Definition of done:** PR open, CI green (if P6.7), every challenge deliverable (§"What to submit" 1–7) present.

---

## 2. Parallelism summary

| Can run together | Why independent |
|---|---|
| P0.2, P0.3, P0.4 · P0.5, P0.6 | Separate config files |
| **Entire API lane (P2–P3) ∥ entire Web lane (P4–P5)** | Shared data types + MSW decouple them; two sync points for validation schemas (P3.6 → P4.6, P3.9 → P5.5) |
| P2.3 ∥ P2.4 | Two adapters behind the same port |
| P2.7 ∥ P2.8 ∥ P2.9 | Independent Fastify plugins |
| P3.1–2 ∥ P3.3–5 ∥ P3.6–7 ∥ P3.8 ∥ P3.9–11 | Separate services/routes over the same ports |
| P4.2 ∥ P4.3 ∥ P4.4 ∥ P4.5 ∥ P4.7 | Independent components |
| P5.1–2 ∥ P5.3 ∥ P5.4–6 | Separate pages |
| P6.1 ∥ P6.2 ∥ P6.7 | Separate files |
| P7.2 ∥ P7.3 | Separate documents |

## 3. Cut line if the time-box runs short

Drop in this order, recording each in DECISIONS.md §9: P6.6 E2E → P6.7 CI → NEW-30 (keep input on close) / NEW-35 (blur validation) / NEW-29 (tab title) / NEW-13 (trailing slash) → P3.8 image proxy hardening beyond allow-list + timeout. **Never cut:** any P0 acceptance criterion, constraint 2 (no client → Fake Store), server-side enquiry validation, fixture source, tests on the critical path.
