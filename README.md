# Product Catalogue

A proof-of-concept product catalogue: customers browse featured products and categories, search, view a product, and send an enquiry that lands in the sales inbox as an email.

It is built as a **foundation, not a throwaway**: the product data source, the look and feel, and the email provider are each behind one boundary so they can be replaced without touching the rest.

| Document | What's in it |
|---|---|
| [DECISIONS.md](DECISIONS.md) | Assumptions, cuts, key technical decisions, next steps, time spent |
| [AI_USAGE.md](AI_USAGE.md) | How AI was used, key prompts, where it was wrong |
| [spec/](spec/) | Functional spec, architecture, implementation plan, spec review, acceptance results |

---

## Run it (one command)

**Prerequisites:** Docker with Compose v2 (Docker Desktop, or Colima on macOS), ports **8080** and **8025** free, internet access (or see [offline](#no-internet-or-fake-store-down)). No accounts, keys or `.env` file needed.

```bash
git clone <this repo> && cd product-catalogue
docker compose up --build
```

When the containers report healthy (first build takes a few minutes: it pulls images and installs dependencies):

| Open | What |
|---|---|
| http://localhost:8080 | The catalogue |
| http://localhost:8025 | **Mailpit**, the local test inbox: every enquiry email appears here (nothing is really sent) |

Try the journey: open a product → **Enquire** → fill in name and email → **Send enquiry** → "Thank you" on the page and the email in Mailpit.

Stop with `Ctrl+C`, or `docker compose down` if started with `-d`.

### No internet, or Fake Store down

The catalogue comes from the free [Fake Store API](https://fakestoreapi.com) by default. A committed snapshot of the same data can be used instead:

```bash
PRODUCT_SOURCE=fixture docker compose up --build
```

### What's running

```
Browser ──▶ web  (Nginx: the React app, and /api/* forwarded) ──▶ api (Node + Fastify) ──▶ Fake Store API or offline snapshot
                                                                       └──▶ Mailpit (SMTP)
```

Only the site (8080) and Mailpit (8025) are published, and only on `127.0.0.1`. The browser never calls Fake Store: product data **and images** go through our API.

---

## Stack, and why

| Layer | Choice | Why |
|---|---|---|
| Client | **React + TypeScript** (Vite), single-page app | One build serves every device by link; no app store for the entrepreneur to share it. SEO isn't a goal yet, so no server rendering. |
| Backend | **Node.js + TypeScript** (Fastify) | Same language as the client, so request/response types and validation rules are **shared** in `packages/shared`. Fastify brings structured logging, schema-friendly routing and fast in-process HTTP tests. |
| Email | SMTP (Nodemailer) → **Mailpit** locally, any provider (e.g. Amazon SES) by configuration | Swapping providers is a config change, and the reviewer can see the email without an account. |
| Packaging | Docker Compose; images run as non-root users | One command locally; the same images fit an AWS container service (ECS/App Runner). |

The API runs its TypeScript directly with Node's built-in type stripping, so there is no compile step (DECISIONS T16). Full reasoning and alternatives: [spec/ARCHITECTURE.md](spec/ARCHITECTURE.md) §1 and §15.

### How it's built to grow

| Will change | Where it's isolated | What changing it takes |
|---|---|---|
| Product data source | `ProductSource` port in the API. Two adapters already: Fake Store and the offline fixture, both passing the same contract tests. | A new adapter (database, CMS…). Services, routes and UI unchanged. |
| Look and feel | `apps/web/src/theme/tokens.css` (all colours, type, spacing) and presentational components | New token values / styles. Pages and data fetching unchanged. |
| Email provider | `Notifier` port over SMTP | SMTP settings, or a new adapter. |
| Enquiry storage | `EnquiryRecorder` port, already in the flow (does nothing today) | A database adapter. |

---

## Configuration

Everything works with the defaults. To change a setting, put it in a `.env` file next to `docker-compose.yml` (copy [.env.example](.env.example), which documents every setting) or set it in the shell. The main ones:

| Setting | Default | Meaning |
|---|---|---|
| `PRODUCT_SOURCE` | `fakestore` | `fakestore` (live API) or `fixture` (offline snapshot) |
| `FEATURED_PRODUCT_IDS` | `1,5,9,15,18` | The owner's 5 "top rated" products for the home page, in order |
| `SALES_INBOX` | `sales@example.com` | Where enquiry emails go. The API refuses to start without a valid address |
| `MAIL_FROM` | `no-reply@example.com` | Sender address |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_SECURE` | Mailpit | Point at a real provider to send real email |
| `ENQUIRY_RATE_LIMIT_MAX`, `ENQUIRY_RATE_LIMIT_WINDOW_MINUTES` | `5`, `15` | Enquiries allowed per visitor per window |
| `CATEGORY_TOP_RATED_COUNT` | `3` | Size of a category page's "Top rated" section |
| `VITE_STORE_NAME` | `Catalogue` | Store name in the header and tab (build-time: rebuild after changing) |
| `WEB_PORT`, `MAILPIT_PORT` | `8080`, `8025` | Ports on this machine |

---

## Tests

```bash
npm ci
npm test              # unit + component tests: shared, API, web (no Docker needed)
npm run lint && npm run typecheck && npm run format:check
```

End-to-end acceptance tests drive a real browser against the running stack:

```bash
docker compose up --build -d --wait
ENQUIRY_RATE_LIMIT_MAX=100 docker compose up -d --wait   # repeated runs send several enquiries
npx --workspace=@catalogue/e2e playwright install chromium   # first time only
npm run test:e2e
```

| Suite | Where | Covers |
|---|---|---|
| Shared | `packages/shared/test` | Validation rules (enquiry, search), error contract |
| API | `apps/api/test` | Config, both product sources (shared contract suite), every service rule, routes and status codes, errors, logging redaction, security headers, rate limiting |
| Web | `apps/web/test` | Every page and state against a mock API typed by the shared contract, the enquiry form, accessibility basics |
| E2E | `e2e/tests` | The challenge's five acceptance criteria in Chromium, including the email arriving in Mailpit |

Tests are named after the spec IDs they cover (e.g. `CAT-01: …`). CI ([.github/workflows/ci.yml](.github/workflows/ci.yml)) runs all of it on every push, the E2E job with the offline source. Latest acceptance run: [spec/ACCEPTANCE_RESULTS.md](spec/ACCEPTANCE_RESULTS.md).

---

## Develop without Docker

Requires **Node.js 24+** (26 used).

```bash
npm ci
npm run dev:api     # API on http://127.0.0.1:3000 (reads .env.example, then .env)
npm run dev:web     # app on http://127.0.0.1:5173, /api forwarded to the API
```

To send test emails from the dev API: `docker compose up -d mailpit` and set `SMTP_HOST=127.0.0.1` in `.env`.

## Repository layout

```
apps/api          Fastify API: config, ports, adapters, services, routes
apps/web          React app: pages, features, shared components, theme
packages/shared   Types and validation rules used by both apps
e2e               Playwright acceptance tests
spec              Working documents (spec, architecture, plan, review, results)
```
