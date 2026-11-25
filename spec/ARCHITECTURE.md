# Technical Architecture — Product Catalogue PoC

> **Status:** Proposal v2 — updated after [SPEC_REVIEW.md](./SPEC_REVIEW.md): no caching (deferred), fixture product source added (R-01), route collision fixed (R-03)
> **Based on:** [FUNCTIONAL_SPEC.md](./FUNCTIONAL_SPEC.md) and [DECISIONS.md](../DECISIONS.md)
> **Audience:** developers building the PoC; reviewers assessing solution design
> Feature IDs (e.g. `ENQ-03`) and assumption IDs (e.g. `A34`, `NEW-48`) refer to those documents.

---

## 0. Architecture at a glance

```
                 Browser (React SPA)
                        │  same origin: /  and  /api/v1/*
                        ▼
 ┌──────────────────────────────────────────┐
 │  web  (static SPA + reverse proxy /api)  │
 └──────────────────────┬───────────────────┘
                        ▼
 ┌──────────────────────────────────────────────────────────────┐
 │  api  (Node.js + TypeScript)                                 │
 │                                                              │
 │  HTTP layer      routes · request validation · error mapping │
 │       │                                                      │
 │  Service layer   catalogue rules · search · enquiry flow     │
 │       │                       (pure business logic)          │
 │  Ports           ProductSource · Notifier · EnquiryRecorder  │
 │       │                                                      │
 │  Adapters        FakeStoreProductSource │ FixtureProductSource  │
 │                  SmtpNotifier · NoopRecorder                 │
 └───────┬───────────────────────────────┬──────────────────────┘
         ▼                               ▼
   Fake Store API  — or —          SMTP server
   committed JSON fixture          (Mailpit locally · Amazon SES on AWS)
   (selected by PRODUCT_SOURCE)
```

**The one idea everything hangs off:** the three things the brief says *will change* — product data source, look and feel, email provider — each sit behind exactly one boundary:

| Will change | Boundary | What changes when it does |
|---|---|---|
| Product data source | `ProductSource` port in the API | Write one new adapter; nothing in services, routes or frontend changes. **Already proven in the PoC: two adapters (Fake Store, fixture) behind one port.** |
| Look and feel | Design tokens (CSS custom properties) + presentational components in the web app | Replace tokens / restyle components; pages, data fetching and routing don't change. |
| Email provider | `Notifier` port in the API | Change SMTP settings, or write one new adapter (e.g. SES API). |

---

## 1. Technology stack

| Layer | Choice | Why | Alternatives considered |
|---|---|---|---|
| Language | **TypeScript** end to end | Preferred by the challenge; one language lets the frontend and backend share the API contract and validation rules. | — |
| Client | **React + Vite**, SPA | Challenge allows React web; Vite is the simplest fast React build. No SSR needed — SEO is out of scope (A46). | **Next.js**: SSR/SEO not needed, and its built-in server blurs the frontend/backend boundary the brief asks us to keep clear. |
| Routing | **React Router** | Gives the addressable pages required by GLB-04. | TanStack Router — fine, less familiar to most reviewers. |
| Server state | **TanStack Query** | Loading/error/retry states (GLB-03) and request de-duplication out of the box, without hand-rolled hooks. Used for request state, not as a caching layer: data is refetched when a page is opened (no caching in the PoC, §3.5). | Plain `fetch` + custom hooks: fewer deps, but we would re-implement retries and state flags. |
| Forms | **React Hook Form + Zod resolver** | Field-level errors using the *same* Zod schema the API enforces (ENQ-02). | Plain controlled inputs: OK for one form, but duplicates validation logic. |
| Styling | **CSS Modules + CSS custom properties (design tokens)** | Zero-runtime, framework-free; the creative agency's output maps onto a token file (CFG-04). | Tailwind (fast, but couples markup to utility classes, harder to hand a re-skin to designers); component library like MUI (imposes its own look the agency would fight). |
| Backend | **Node.js (LTS) + Fastify** | Challenge allows Node/TS. Fastify has structured logging (pino) built in, first-class TypeScript, schema-based validation, and an `inject()` API that makes HTTP tests fast without opening ports. | **Express**: most familiar, but logging, validation and typed routes are all bolt-ons. **NestJS**: strong structure but heavy for a 2–3h PoC. **Laravel**: allowed, but loses the shared TypeScript contract. |
| Validation | **Zod** (shared package) | One schema → TypeScript types + runtime validation in browser and server; also validates config and upstream data. | Joi / class-validator: no type inference shared with React. |
| Email | **Nodemailer over SMTP** | SMTP is the most portable interface: Mailpit locally, Amazon SES (SMTP interface) on AWS, or any other provider — config change only (A35). | Provider SDK (SES/SendGrid API) directly: ties code to a vendor; can still be added as a second `Notifier` adapter. |
| Local mailbox | **Mailpit** (Docker) | Free, no account, web UI to view captured emails (CFG-03). Actively maintained. | MailHog: unmaintained. Ethereal: needs network + generated account. |
| Testing | **Vitest**, **React Testing Library**, **MSW**, Fastify `inject()`, **Playwright** (one E2E) | Fast, one runner for both apps; MSW mocks HTTP at the network layer for both frontend and adapter tests. | Jest (slower with TS/ESM), Supertest (fine, `inject()` is native). |
| Packaging | **npm workspaces** monorepo, **Docker Compose** | One repo, one `docker compose up` for the reviewer (constraint 4). | Separate repos: more friction for a PoC; pnpm/turborepo: extra tooling for no gain at this size. |
| Database | **None in the PoC** | No requirement to persist anything (A34). See §4. | SQLite/Postgres for enquiries — next step #1. |

### Repository layout

```
product-catalogue/
├── package.json             workspace root only: lists workspaces + convenience scripts (no app dependencies)
├── apps/
│   ├── web/                 React SPA      — own package.json (react, vite, …), tsconfig, Dockerfile
│   └── api/                 Fastify API    — own package.json (fastify, nodemailer, …), tsconfig, Dockerfile
├── packages/
│   └── shared/              Zod schemas + TypeScript types — own package.json (zod only)
├── spec/                    working documents: FUNCTIONAL_SPEC.md, ARCHITECTURE.md, SPEC_REVIEW.md
├── docker-compose.yml       web + api + mailpit
├── .env.example             every setting documented, safe defaults, no secrets
├── README.md · DECISIONS.md · AI_USAGE.md · CLAUDE.md   (assessed deliverables at repo root)
```

**Each app is its own package.** `web` and `api` each have their own `package.json`, dependencies, scripts, tsconfig and Dockerfile; React never ends up in the API and Fastify never ends up in the browser bundle. Each depends on `@catalogue/shared` like any other package. npm workspaces only add one root lockfile and the ability to run `npm install` / `npm test` once from the root.

| Option | Pros | Cons |
|---|---|---|
| **Separate package.json per app + npm workspaces (chosen)** | Clear per-app dependencies; one install/lockfile; local `shared` package linked automatically | One root `package.json` to understand |
| Fully independent folders (no workspaces) | Maximum separation | Can't share the contract package without publishing it or copying files; two installs, two lockfiles |

**Trade-off — shared package:** adds a workspace and build step, but prevents the frontend and backend contracts drifting apart, and enables one enquiry schema for both validations (A29). Worth it.

---

## 2. Frontend architecture

### 2.1 Structure

```
apps/web/src/
├── app/            router, providers (TanStack Query), error boundary, layout shell
├── pages/          HomePage, CategoryPage, SearchPage, ProductPage, NotFoundPage
├── features/
│   ├── catalogue/  ProductTile, ProductGrid, CategoryNav, query hooks
│   ├── search/     SearchBar, query hook
│   └── enquiry/    EnquiryForm, ThankYou, mutation hook
├── components/     generic UI: Button, PageState (loading/empty/error), Price, Rating
├── api/            the ONLY module that knows API paths; typed client using shared types
└── theme/          tokens.css (colours, fonts, spacing), branding config
```

### 2.2 Rules

- **Pages compose, features own behaviour, components only render.** Pages don't fetch directly; they use feature hooks (e.g. `useCategoryProducts`).
- **One API client module.** All requests go through `api/`; it is the only place that knows URLs. The browser never talks to Fake Store (constraint 2) — including **images** (see §10.3).
- **No business rules in the browser.** Ranking, splitting top rated vs more, search matching and featured resolution all happen in the API. The UI renders what it receives. This keeps rules testable in one place and lets a future mobile app reuse them.
- **Branding in one place** (CFG-04): `theme/tokens.css` + store name from a build-time setting.
- **Page states** (GLB-03): one `PageState` component handles loading / empty / error with **Try again** (calls the query's `refetch`).

### 2.3 Routing (GLB-04)

| Route | Page |
|---|---|
| `/` | HomePage (HOM-01, HOM-02) |
| `/category/:category` | CategoryPage (CAT-01, CAT-02) |
| `/search?q=` | SearchPage (SRC-02, SRC-03) |
| `/product/:id` | ProductPage (PRD-01, PRD-02, ENQ-*) |
| `*` | NotFoundPage |

SPA fallback: the web server returns `index.html` for unknown paths so deep links and reloads work.

### 2.4 Trade-offs

| Decision | Trade-off |
|---|---|
| SPA, no SSR | Simpler, clean FE/BE split; costs SEO and first-paint speed. Acceptable for a PoC (A46). Revisit with Next.js/SSR or prerendering if SEO matters. |
| Store name as build-time setting | Changing it needs a rebuild (`docker compose up --build`). Runtime config endpoint would avoid that but adds an API call for little value now. |
| Category split computed server-side | Slightly larger, more specific endpoint; but rules live in one place and are client-agnostic. |

---

## 3. Backend architecture

### 3.1 Layers (ports & adapters)

```
apps/api/src/
├── config/        env loading + Zod validation (fail fast, NEW-48)
├── http/          Fastify app, routes, error handler, plugins (rate limit, security headers)
├── services/      CatalogueService, SearchService, EnquiryService  — pure logic
├── ports/         ProductSource, Notifier, EnquiryRecorder  — interfaces
├── adapters/
│   ├── fakestore/ FakeStoreProductSource (+ mapping to our Product model)
│   ├── fixture/   FixtureProductSource + products.json (committed snapshot)
│   ├── email/     SmtpNotifier
│   └── recorder/  NoopEnquiryRecorder
└── main.ts        composition root: reads config, picks adapters, wires services
```

| Layer | Knows about | Must not know about |
|---|---|---|
| HTTP | Fastify, request/response shapes, status codes | Fake Store, SMTP |
| Services | Our domain model, ports | HTTP, Fake Store, SMTP |
| Adapters | One external system each | HTTP routes, other adapters |
| Composition root | Everything — wiring only | — |

### 3.2 Domain model

Our own `Product` type (`id`, `title`, `price`, `description`, `category`, `imageUrl`, `rating { average, count } | null`). The Fake Store adapter maps its shape (`rating.rate`, `image`, numeric `id`) into ours. **Fake Store's field names never leave the adapter.** IDs are strings everywhere (A4a) so a future `SKU-1042` works without changes.

### 3.3 Ports

| Port | Operations | PoC adapter | Future adapters |
|---|---|---|---|
| `ProductSource` | list all products, get by id, list categories | `FakeStoreProductSource` (default) · `FixtureProductSource` (offline / tests) | Database, headless CMS, Shopify, internal PIM |
| `Notifier` | send enquiry notification | `SmtpNotifier` (Mailpit / SES SMTP) | SES API, SendGrid, Slack/CRM webhook |
| `EnquiryRecorder` | record enquiry | `NoopEnquiryRecorder` (A34) | Postgres + outbox (next step #1) |

### 3.4 Services — where each rule lives

| Service | Responsibilities | Spec |
|---|---|---|
| `CatalogueService` | featured resolution (order, skip stale + warn, cap 5); categories (sorted); category page split (rank, tie-breaks, top N, no duplicates, unrated → "more"); case-insensitive category match; product by id | HOM-01, HOM-02, CAT-01, CAT-02, PRD-01, PRD-02, CFG-01 |
| `SearchService` | trim, length check, case-insensitive literal substring over title/description/category, data-source order | SRC-01, SRC-02 |
| `EnquiryService` | **validate → look up product → record → notify**; product details taken from the catalogue, never from the request | ENQ-02 – ENQ-05, A28, A34 |

### 3.5 Data access (no caching in the PoC)

**Decision: no caching yet.** Every API request reads from the selected `ProductSource`; nothing is held between requests. Caching is deferred to keep the PoC simple and its behaviour easy to reason about and test (data is always current; no staleness rules). It is the first scalability/resilience step (§13).

How each read is served (Fake Store has no search, and the catalogue is 20 products):

| Read | `ProductSource` call | Done in service |
|---|---|---|
| Featured (HOM-01) | list all products (one call) | pick configured IDs in order, skip missing |
| Categories (GLB-01, HOM-02) | list categories | sort, format labels |
| Category page (CAT-01) | list all products | filter by category, rank, split |
| Search (SRC-02) | list all products | literal case-insensitive match |
| Product by id (PRD-01), enquiry lookup (ENQ-03), image proxy | get by id | — |

- Upstream calls have a **timeout** (default 5s) (NEW-09) and responses are validated with Zod; malformed records are dropped and logged (NEW-10).
- If the source fails, the request fails with `502 PRODUCT_SOURCE_UNAVAILABLE` and the UI shows its error state (GLB-03).

| Trade-off | Accepted because |
|---|---|
| Every page view calls the upstream API (no resilience to Fake Store outages beyond the error state) | Keeps the PoC simple; the **fixture source** (§3.6) covers the "Fake Store is down on review day" risk. |
| Fetching the full list to filter/search | 20 products. At scale the port gains query methods and the real source filters (§13). |
| Search in application code | Fake Store can't search. Behind `SearchService`, so swapping to DB full-text or OpenSearch later is local. |

> **Known quirk to verify during build:** Fake Store returns `200` with an empty body for unknown product IDs. `FakeStoreProductSource.getById` must map that to "not found"; an adapter test pins the behaviour.

### 3.6 Second product source: fixture

`FixtureProductSource` reads a **committed JSON snapshot** of the Fake Store catalogue (`adapters/fixture/products.json`, our own `Product` shape) and implements the same `ProductSource` port.

| Used for | Why |
|---|---|
| Running with no internet / when Fake Store is down | Reviewer can still run the PoC in < 10 minutes (constraint 4); documented fallback in the README. |
| Automated tests and E2E | Deterministic data → stable expected results; no flaky external calls. |
| Proving the boundary | Two real adapters behind one port demonstrate that the data source is swappable, not just claimed. |

- Selected by `PRODUCT_SOURCE=fakestore|fixture` (default `fakestore`, which satisfies the brief). The composition root is the only place that reads it.
- The fixture is read-only and loaded at startup.
- Image proxy with the fixture source: images are served from a local folder of committed placeholder images, so the fixture works fully offline.
- **Trade-off:** the snapshot can drift from live Fake Store. Accepted: it is test/fallback data, refreshed manually if needed.

### 3.7 Configuration

All configuration via environment variables, validated by Zod at startup; documented in `.env.example`.

| Setting | Default (example file) | On invalid |
|---|---|---|
| `PRODUCT_SOURCE` | `fakestore` (or `fixture`) | refuse to start |
| `PRODUCT_SOURCE_URL` | `https://fakestoreapi.com` (only used when `PRODUCT_SOURCE=fakestore`) | refuse to start |
| `FEATURED_PRODUCT_IDS` | 5 valid Fake Store IDs, also present in the fixture (NEW-47) | warn, continue (CFG-01) |
| `CATEGORY_TOP_RATED_COUNT` | `3` (A8) | refuse to start |
| `SALES_INBOX`, `MAIL_FROM` | `sales@example.com`, `no-reply@example.com` | **refuse to start** (NEW-48) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_SECURE` | Mailpit (`mailpit:1025`, no auth) | refuse to start |
| `ENQUIRY_RATE_LIMIT_MAX`, `ENQUIRY_RATE_LIMIT_WINDOW_MINUTES` | `5`, `15` (NEW-43) | refuse to start |
| `PUBLIC_SITE_URL` | `http://localhost:8080` (used for product links in emails) | refuse to start |
| `LOG_LEVEL`, `TRUST_PROXY` | `info`, `1` (number of trusted proxy hops; never `true`, see R-07) | refuse to start |
| `VITE_STORE_NAME` (web, build-time) | `Catalogue` (CFG-04) | — |

---

## 4. Database design

**Decision: no database in the PoC** (A34). The product data lives in the data source; featured products and settings live in configuration; enquiries are delivered by email and not stored.

| Why not | Cost avoided |
|---|---|
| No acceptance criterion needs persisted data | Schema, migrations, a DB container, seed data, backups |
| Storing customer PII creates retention/deletion obligations (A37) | A privacy policy the PoC can't define |
| Lead loss already mitigated (A31) | — |

**Designed-for, not built:** the `EnquiryRecorder` port is already in the enquiry flow. When next step #1 is taken:

- **Engine:** PostgreSQL (Amazon RDS / Aurora on AWS; container locally).
- **`enquiries` table (sketch):** id (UUID), product_id, product_title_snapshot, product_price_snapshot, customer_name, customer_email, customer_phone (nullable), message (nullable), status (`pending` / `sent` / `failed`), attempts, last_error, created_at, sent_at. Index on (status, created_at).
- **Flow change:** record (`pending`) → show Thank you → background worker sends email with retries (transactional outbox) → `sent`. Removes ENQ-05's customer-facing failure and NEW-42's duplicate risk.
- **Retention:** scheduled deletion/anonymisation after an agreed period (needs Q3/Q6 answers).
- **Later candidates:** `featured_products` (when an admin UI replaces CFG-01), products themselves if the business owns its catalogue.

---

## 5. Authentication and authorization

**Decision: no authentication in the PoC.**

- Customers are anonymous (A38). All catalogue endpoints are public, read-only.
- The enquiry endpoint is public by design; it is protected by validation, size limits and rate limiting (§10), not identity.
- There is no admin surface (A2). Owner actions happen through configuration, which is protected by whoever controls deployment/secrets.
- Mailpit's UI is a **local-only** tool and is never part of a deployed environment.

**When an admin UI arrives (featured products, enquiry inbox):**

| Option | Notes |
|---|---|
| **Amazon Cognito** (recommended on AWS) | Managed users, MFA, hosted UI, JWTs; no password storage in our code. |
| Any OIDC provider (Auth0, Entra ID, Google Workspace) | Same JWT-verification pattern; good if the business already has an identity provider. |
| Roll-your-own sessions | Not recommended — security burden for no benefit. |

Authorization would be role-based (`owner`, `sales`) enforced in a Fastify hook on `/api/v1/admin/*` routes; public routes stay untouched.

---

## 6. API design

### 6.1 Conventions

- REST over JSON, base path **`/api/v1`**. Versioned from day one because a future mobile client could be on an older version than the web app.
- Resource-oriented, read endpoints are `GET`; one `POST` for enquiries. Responses are sent with `Cache-Control: no-store` for now (no caching in the PoC, §3.5).
- **Per-ID routes own their path level:** under `/products/` the only second segment is `{id}`. Lists, filters and curated sets use query parameters or their own resource name, so no product ID (they are opaque strings, A4a) can ever collide with a route name (R-03).
- Product IDs and category names are path segments, URL-encoded.
- Errors use **RFC 9457 Problem Details** (`application/problem+json`) with a stable machine-readable `code` (§8).
- Response shapes come from `packages/shared` and are the contract for both sides.
- Collections are returned as `{ items: [...] }` (not bare arrays) so pagination metadata can be added later without a breaking change (§13).

### 6.2 Endpoints

| Method & path | Purpose | Success | Errors | Spec |
|---|---|---|---|---|
| `GET /api/v1/health` | Liveness (does not call upstream) | `200 {status:"ok"}` | — | ops |
| `GET /api/v1/featured-products` | Owner-chosen featured products, in order, stale skipped | `200 {items: Product[]}` (may be empty) | `502` | HOM-01 |
| `GET /api/v1/categories` | All categories, alphabetical | `200 {items: Category[]}` | `502` | GLB-01, HOM-02 |
| `GET /api/v1/categories/{category}/products` | Category page, already split | `200 {category: Category, topRated: Product[], more: Product[]}` | `404 CATEGORY_NOT_FOUND`, `502` | CAT-01, CAT-02 |
| `GET /api/v1/products?q={term}` | Search: literal case-insensitive match. `q` is **required** (listing the whole catalogue without a term is not a feature) | `200 {query, items: Product[]}` | `400 VALIDATION_FAILED` (missing/empty/too long), `502` | SRC-01 – SRC-03 |
| `GET /api/v1/products/{id}` | Product details | `200 Product` | `404 PRODUCT_NOT_FOUND`, `502` | PRD-01, PRD-02 |
| `GET /api/v1/products/{id}/image` | Image proxy (§10.3) | `200` image bytes | `404`, `502` | constraint 2 |
| `POST /api/v1/enquiries` | Send enquiry | `202 Accepted` | `400 VALIDATION_FAILED` (field errors), `422 PRODUCT_UNAVAILABLE`, `429 RATE_LIMITED`, `502 EMAIL_DELIVERY_FAILED`, `502 PRODUCT_SOURCE_UNAVAILABLE` | ENQ-01 – ENQ-06 |

**`Product` (response):** `id` (opaque string), `title`, `price` (number, USD), `description`, `category` (a `Category`, so the UI can show the label and link to the category page without another request), `imageUrl` (our proxy path), `rating` (`{average, count}` or `null`).
**`Category`:** `{ id, name }` — `id` is an opaque identifier used in URLs (`/category/{id}`), consistent with product IDs; `name` is the display label (NEW-02). How `id` is derived from the data source is open (R-09); until decided it is the raw data-source value.
**Enquiry request:** `productId`, `name`, `email`, `phone?`, `message?`. Any extra fields (e.g. a product title) are **rejected/ignored** (A28).

### 6.3 Trade-offs

| Decision | Alternative | Why |
|---|---|---|
| `202 Accepted` for enquiries | `201 Created` | Nothing is created/stored (A34); "accepted for sending" is exactly what A31 promises. Becomes `201` with an id once enquiries are persisted. |
| Purpose-built endpoints (featured, category split) | Generic `/products?filter=…` and let the client compose | Business rules stay server-side and testable; simpler client; easier for a second client. Costs some flexibility. |
| Search as `GET /products?q=`, featured as `/featured-products` | `/products/search`, `/products/featured` | The latter collide with `/products/{id}` for a product whose ID is `search` or `featured` (R-03). Filtering a collection via query string is idiomatic REST. |
| REST | GraphQL / tRPC | REST is simplest to cache later (CDN), document and consume from a future native app. tRPC would couple the client to TS. |

---

## 7. Validation strategy

Validate at **every trust boundary**, using Zod schemas defined once.

| Boundary | What is validated | Where | On failure |
|---|---|---|---|
| Configuration → API | All env vars (types, ranges, email format) | API startup | Refuse to start with a clear message; featured IDs only warn (CFG-01, CFG-02) |
| Browser → API (params) | `id` (non-empty, length cap), `category` (length cap), `q` (trimmed, 1–100 chars) | Route schemas | `400 VALIDATION_FAILED` |
| Browser → API (body) | Enquiry schema: trim, required, lengths, email format, phone charset, **no CR/LF in name/email**, unknown fields stripped; body size limit (e.g. 10 KB) | Route schema (authoritative) | `400` with per-field messages |
| User → Browser | Same enquiry schema via React Hook Form | Form | Inline field errors (UX only, never trusted) |
| Upstream → API | Fake Store responses against an upstream schema; fixture file against our `Product` schema at startup | Adapter | Fake Store: drop malformed records + warn (NEW-10); whole response invalid → upstream failure. Fixture: invalid file → refuse to start |

**Single source of truth:** the field rules from ENQ-02 live only in `packages/shared`. Error **messages** for users live there too, so browser and server show identical text.

---

## 8. Error handling

### 8.1 Error taxonomy (API)

| Code | HTTP | Cause | Customer sees (spec) |
|---|---|---|---|
| `VALIDATION_FAILED` | 400 | Bad params/body; includes `errors: {field: message}` | Field messages (ENQ-02) / "Enter a search term" |
| `PRODUCT_NOT_FOUND` | 404 | Unknown/stale product id | PRD-02 |
| `CATEGORY_NOT_FOUND` | 404 | Unknown category | CAT-02 |
| `PRODUCT_UNAVAILABLE` | 422 | Enquiry for product no longer in catalogue | "Sorry, this product is no longer available." (NEW-36) |
| `RATE_LIMITED` | 429 | Enquiry limit exceeded | ENQ-06 message |
| `PRODUCT_SOURCE_UNAVAILABLE` | 502 | Data source timeout/error | Error state + Try again (GLB-03) |
| `EMAIL_DELIVERY_FAILED` | 502 | SMTP/provider failure | ENQ-05 message |
| `INTERNAL_ERROR` | 500 | Anything unexpected | Generic error state |

### 8.2 Principles

- **Typed domain errors** thrown by services/adapters (e.g. `ProductNotFoundError`, `UpstreamUnavailableError`); **one central Fastify error handler** maps them to Problem Details. Routes contain no try/catch boilerplate.
- **Never leak internals:** no stack traces, upstream URLs or SMTP messages in responses (A43). Every error response includes the `requestId` so a log line can be found.
- **"Unavailable" ≠ "not found":** the handler never turns an upstream failure into a 404 (CAT-02, PRD-02 error scenarios).
- **Frontend:** the API client turns Problem Details into a typed error; pages switch on `code`: `*_NOT_FOUND` → not-found view, `VALIDATION_FAILED` → field errors, everything else → `PageState` error with **Try again**. A top-level React error boundary catches render bugs.
- **Retries:** TanStack Query retries GETs once on 5xx; **never** auto-retries the enquiry POST (avoids duplicate emails; NEW-42).

---

## 9. Logging and monitoring

### 9.1 Logging (PoC)

- **Structured JSON logs** via pino (Fastify built-in), to stdout — container-native, ships to CloudWatch unchanged.
- **Request ID** on every request (incoming `x-request-id` honoured or generated), included in every log line and every error response.
- **PII redaction** (A37): pino `redact` on enquiry body fields (`name`, `email`, `phone`, `message`) and on headers like `authorization`/`cookie`. Enquiry events log `productId`, outcome and `requestId` only.
- **Named events** (stable `event` field, easy to alarm on):

| Event | Level | When |
|---|---|---|
| `featured.id_missing` | warn | Configured featured ID not in catalogue (A4) |
| `config.featured_normalised` | warn | Duplicates/extra IDs dropped (NEW-46) |
| `product_source.failed` | error | Data source timed out / errored; request returned 502 |
| `product_source.record_invalid` | warn | Malformed upstream record dropped |
| `enquiry.sent` | info | Email accepted by provider |
| `enquiry.failed` | error | Email delivery failed |
| `enquiry.rate_limited` | warn | 429 issued |

### 9.2 Monitoring

| PoC (local) | On AWS (designed-for) |
|---|---|
| `/api/v1/health`; Docker health checks; logs in terminal | CloudWatch Logs + metric filters on `event`; alarms on **any `enquiry.failed`** (lost-lead risk), 5xx rate, `product_source.failed`; ALB/CloudFront metrics; optional X-Ray/OpenTelemetry tracing |

**Trade-off:** no APM/tracing in the PoC — logs with request IDs are enough at this size and need no account (constraint 6).

---

## 10. Security considerations

### 10.1 Controls

| Threat | Control |
|---|---|
| Injection via form input into email | Plain-text email only; **CR/LF rejected** in name/email (header injection, NEW-32); customer email used only as `Reply-To`, never `From`. |
| XSS | React escapes by default; no raw-HTML rendering; search term rendered as text (SRC-02.FR3); strict **Content-Security-Policy** (`img-src 'self'` works because images are proxied). |
| Tampered enquiry (fake product/price) | Product details looked up server-side by id; unknown body fields stripped (A28). |
| Spam / abuse of email endpoint | Rate limit per client IP on `POST /enquiries` (NEW-43), body size limit, field limits; `TRUST_PROXY` set correctly so the real client IP is used. |
| Abuse of read endpoints | Every read calls the data source (no caching yet), so heavy traffic is passed upstream. Accepted for the PoC; mitigations are caching (§13) and a global rate limit. |
| SSRF via image proxy | Proxy only accepts a **product id**, looks up that product's image URL from the catalogue, and only fetches from an **allow-listed host**. No arbitrary URLs. |
| Secrets in repo | `.env` git-ignored; `.env.example` with safe defaults only (constraint 5); AWS Secrets Manager/SSM in deployed envs. |
| Insecure headers | `@fastify/helmet` (CSP, `X-Content-Type-Options`, `Referrer-Policy`, frame-ancestors none). HTTPS terminated at CloudFront/ALB on AWS. |
| CORS | **Not enabled** — same-origin via the web proxy. Avoids a common misconfiguration. |
| PII exposure | Not stored (A34); redacted from logs (A37); only sent to the configured inbox. |
| Vulnerable dependencies | `npm audit` in CI; lockfile committed; minimal dependency set. |
| Container hardening | Non-root user, slim base images, only required ports exposed; Mailpit not deployed beyond local. |

### 10.2 Out of scope (PoC)

CAPTCHA (A36), WAF rules, bot detection, consent/privacy notice (Q6). WAF rate-based rules are the natural AWS upgrade.

### 10.3 Decision: proxy product images

Fake Store image URLs point at `fakestoreapi.com`. Letting the browser load them directly would mean the client **does** call Fake Store, which a reviewer could reasonably read as breaking constraint 2, and would tie the UI to the source's image hosting.

| Option | Pros | Cons |
|---|---|---|
| **A. Proxy via `/api/v1/products/{id}/image` (chosen)** | Browser never contacts Fake Store; strict CSP possible; image hosting becomes swappable (S3/CloudFront later) with no UI change | Extra API code + bandwidth through the API; every image view is an upstream request until caching is added (§13) |
| B. Pass through upstream URLs | Zero work | Arguably violates constraint 2; couples UI to source hosting; looser CSP |

---

## 11. Testing strategy

Aim: tests that cover the critical path and let someone change the code with confidence — not coverage for its own sake. Test names reference feature IDs (e.g. `CAT-01: ties broken by rating count`) for traceability to the spec.

| Level | Scope | Tools | Examples |
|---|---|---|---|
| **Unit — services** (most tests) | Business rules with in-memory fake ports | Vitest | Featured order/stale skip/cap 5/dedupe; category split + tie-breaks + unrated; search case-insensitivity, `men's` → women's clothing, literal `.*`; enquiry: product looked up, notifier called once, recorder called, failure propagates |
| **Unit — shared schemas** | Enquiry & config validation | Vitest | Required fields, lengths, CR/LF rejection, email formats, featured ID normalisation |
| **Adapter / contract** | Fake Store mapping, invalid records, timeouts, empty-body quirk; fixture file loads and validates; **same contract test suite run against both `ProductSource` adapters**; SMTP message composition (To/From/Reply-To/subject/body) | Vitest + MSW (HTTP), Nodemailer stream/JSON transport | Upstream `rating` missing → `null`; malformed record dropped; unknown id → not found in both adapters |
| **API integration** | Routes + error handler + validation + rate limit, real services, fixture source + recording notifier | Fastify `inject()` | 404 vs 502 distinction; 400 field errors; 429 after N; 202 on success; `/products/featured`-style IDs resolve as product IDs; no PII in logs |
| **Frontend component** | Pages & forms against mocked API | React Testing Library + MSW | Loading/error/Try again; not-found views; search empty hint; enquiry field errors, button disabled while sending, Thank you only on 202, input kept on 502 |
| **End-to-end** (one happy path) | Full stack in Docker incl. Mailpit, `PRODUCT_SOURCE=fixture` | Playwright | Home → category → product → enquiry → assert email via Mailpit's API |

- **Test doubles over mocks:** `FixtureProductSource` (the real adapter) and an in-memory `RecordingNotifier` implement the real ports, so tests exercise real wiring with deterministic data.
- **No live Fake Store calls in automated tests** (flaky, external); Fake Store adapter tests use MSW with recorded responses.
- **CI (GitHub Actions):** install → lint → typecheck → unit/integration → build images. E2E optional on CI (P2 under the time-box).

**Trade-off:** one E2E test only. E2E is slow and brittle; the business rules are covered far more cheaply at the service level.

---

## 12. Deployment architecture

### 12.1 Local (reviewer, < 10 minutes)

```
docker compose up --build
```

| Service | Image | Port | Role |
|---|---|---|---|
| `web` | Multi-stage: build SPA → serve with Nginx | `8080` | Static SPA, SPA fallback, proxies `/api/*` → `api` |
| `api` | Multi-stage Node build, non-root | internal `3000` | Fastify API |
| `mailpit` | `axllent/mailpit` | `8025` (UI), internal `1025` (SMTP) | Captures enquiry emails (CFG-03) |

Reviewer opens `http://localhost:8080` (site) and `http://localhost:8025` (mailbox). `.env.example` defaults work as-is; copying to `.env` is optional. **No internet / Fake Store down:** set `PRODUCT_SOURCE=fixture` and run the same command. Developer mode (hot reload via Vite proxy) is documented separately in the README.

### 12.2 AWS target (designed-for, not built in the PoC)

```
Route 53 → CloudFront ─┬─ /*        → S3 (built SPA)
                       └─ /api/*    → ALB → ECS Fargate (api, ≥2 tasks, multi-AZ)
                                                │
                              Amazon SES ◄──────┤   Secrets Manager / SSM (config, SMTP creds)
                              Product source ◄──┘   CloudWatch (logs, metrics, alarms)
```

| Decision | Alternative | Why |
|---|---|---|
| **ECS Fargate** for the API | **Lambda + API Gateway** | Same container as local (parity, no rewrite); the in-memory rate limiter (and a future in-memory cache) stay effective on long-lived tasks. Lambda is cheaper at very low traffic but cold starts and per-invocation state would need ElastiCache sooner. **App Runner** is a simpler alternative for a single service. |
| **S3 + CloudFront** for the SPA | Serve SPA from the API container | Global caching, cheap; keeps same-origin by routing `/api/*` at CloudFront (no CORS). |
| **SES** for email | SendGrid, Postmark | Native to AWS; reachable via SMTP so only config changes. |
| No IaC in the PoC | AWS CDK / Terraform | Time-box. CDK (TypeScript) is the natural next step and stays AWS-compatible (constraint 3). |

---

## 13. Scalability considerations

The PoC is sized for 20 products and demo traffic. What changes as it grows — and where the design already absorbs it:

| Pressure | First limit hit | Response (contained behind…) |
|---|---|---|
| Upstream latency / availability | Every request calls the data source (no caching in the PoC) | **First step: add caching** as a `ProductSource` decorator (in-memory snapshot with TTL, serve last-good on failure) — no service or route changes. Then `Cache-Control` on `GET` responses + CloudFront. Deferred deliberately (§3.5). |
| More traffic | Single API container | API is **stateless** → scale ECS tasks horizontally behind ALB; caching (row above) cuts upstream load. |
| Rate limiting across instances | In-memory limiter is per instance | Move limiter store to Redis (ElastiCache) or AWS WAF rate rules — plugin config change. |
| Larger catalogue (thousands+) | Fetching the full list per request to filter/search | `ProductSource` gains paged/queried methods; real source (DB/CMS) does filtering; add cursor pagination to `{items, nextCursor}` (envelope already in place). |
| Better search | Substring scan | `SearchService` delegates to Postgres full-text or OpenSearch; API contract unchanged. |
| Enquiry volume / reliability | Synchronous SMTP in request path | Persist + outbox + SQS worker (next step #1); `202` semantics already match async. |
| Images | Proxy through API, uncached | Add `Cache-Control` + CloudFront in front of the proxy; later, source images live on S3/CloudFront and the adapter returns those URLs. |
| More clients (native app) | — | Versioned REST API with business rules server-side; nothing web-specific in the API. |
| Owner self-service | Config-driven featured list | Admin API + Cognito auth + `featured_products` table; `CatalogueService` reads featured IDs through a small port instead of config. |

---

## 14. Architectural constraints

### 14.1 From the challenge (hard)

1. One client (React web) and one backend (Node.js TypeScript).
2. The browser must never call Fake Store directly — includes images (§10.3).
3. Any infrastructure must be AWS-compatible.
4. Reviewer runs it locally in < 10 minutes with one or two commands.
5. No committed secrets; `.env.example` for configuration.
6. No paid services or accounts required to run or verify (Mailpit, no auth, free Fake Store or offline fixture).

### 14.2 Self-imposed (to keep the foundation clean)

7. Business rules live only in API services — not in routes, adapters or the browser.
8. External systems are reached only through ports; Fake Store / SMTP types never leak past their adapter.
9. The web app calls the API only through its `api/` module.
10. Shared contract (types + Zod schemas) is the single definition of request/response shapes.
11. Every external call has a timeout; every boundary validates input.
12. No customer PII in logs or storage in the PoC.
13. Configuration is validated at startup; missing critical settings fail fast.
14. No caching layer in the PoC (server or HTTP); when added, it goes behind the `ProductSource` port as a decorator.
15. Every `ProductSource` adapter passes the same contract test suite.
16. Route names never share a path level with an opaque ID.

---

## 15. Summary of key trade-offs

| # | Decision | Chosen | Main alternative | Deciding factor |
|---|---|---|---|---|
| T1 | Rendering | SPA (Vite) | Next.js SSR | Clear FE/BE boundary; SEO out of scope |
| T2 | Backend framework | Fastify | Express / NestJS | Built-in logging, validation, `inject()` testing; light |
| T3 | Code organisation | Ports & adapters | Layered MVC calling Fake Store from controllers | Brief says data source & email provider will change |
| T4 | Data access | Read from the source on every request, no caching | In-memory cached catalogue | Simplest, always current, easy to test; caching is a later decorator (§13) |
| T5 | Business rules | Server-side, purpose-built endpoints | Generic API, rules in client | One tested place; reusable by future clients |
| T6 | Persistence | None | Postgres for enquiries | No criterion needs it; PII burden; port ready (A34) |
| T7 | Email | SMTP (Nodemailer) + Mailpit | Vendor SDK | Provider swap = config; zero-account local verification |
| T8 | Images | Proxy through API | Direct upstream URLs | Constraint 2; swappable hosting; strict CSP |
| T9 | Shared contract | Zod in shared package | Duplicate types/validation | No drift; same messages browser & server |
| T10 | Styling | CSS Modules + tokens | Tailwind / component library | Easy hand-off to creative re-skin |
| T11 | AWS compute | ECS Fargate | Lambda / App Runner | Container parity with local; long-lived tasks suit in-memory limiter |
| T12 | Enquiry response | 202 Accepted | 201 Created | Nothing stored yet; honest semantics |
| T13 | Second product source | Committed JSON fixture adapter | Live Fake Store only / MSW-only test data | Offline run for reviewer, deterministic tests, proves the swappable boundary |
| T14 | Route naming | `/products?q=`, `/featured-products` | `/products/search`, `/products/featured` | No collision with opaque product IDs |
