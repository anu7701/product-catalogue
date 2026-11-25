# CLAUDE.md — instructions for AI agents working in this repo

## What this is

Proof-of-concept product catalogue: browse, search, view products, send an enquiry email to sales. It is a **foundation, not a throwaway** — the product data source, look and feel and email provider will all change.

## Read before changing anything

| Document | Use it for |
|---|---|
| `DECISIONS.md` | Every assumption (A1–A46, NEW-01–NEW-49) and technical decision (T1–T14). **Source of truth.** |
| `spec/FUNCTIONAL_SPEC.md` | Feature behaviour, business rules, acceptance criteria (feature IDs like `ENQ-03`) |
| `spec/ARCHITECTURE.md` | Layers, ports, API design, validation, errors, logging, security |
| `spec/IMPLEMENTATION_PLAN.md` | Phases and tasks (`P2.4` etc.). Work one task at a time. |
| `spec/SPEC_REVIEW.md` | Open review findings (R-xx). Items marked open/deferred are not decided — don't silently pick an answer. |

If the spec and the code disagree, or the spec is silent, **stop and ask** rather than inventing a rule. If a deviation is agreed, record it in `DECISIONS.md`.

## Layout

```
apps/web         React SPA (Vite)            — own package.json
apps/api         Fastify API (Node, TS)      — own package.json
packages/shared  Shared types + Zod schemas  — imported by both apps
spec/            Working documents
```

## Commands (from repo root)

- `npm install` — install all workspaces
- `npm test` — all tests · `npm test -w @catalogue/api` — one package
- `npm run typecheck` · `npm run lint` · `npm run format` / `format:check`

All four must pass before a task is done.

## Architecture rules (non-negotiable)

1. **Business rules live only in API services** (`apps/api/src/services`). Not in routes, adapters, or the browser.
2. **External systems only through ports** (`ProductSource`, `Notifier`, `EnquiryRecorder`). Fake Store / SMTP types never leave their adapter.
3. **The browser never calls Fake Store** — including images (proxied via the API).
4. **The web app calls the API only through `apps/web/src/api/`.**
5. **Validation schemas live in `packages/shared`**, written in the task that first needs them and reused elsewhere — never redefined.
6. **Product IDs are opaque strings.** Never parse, compare numerically or assume a format.
7. **No caching** (server, HTTP or client-side caching layer) until explicitly decided.
8. **No customer personal data in logs** (name, email, phone, message). Use the logger's redaction; log product ID, outcome and request ID instead.
9. **Every external call has a timeout; every boundary validates input.**
10. Route names never share a path level with an ID (`/products?q=`, `/featured-products`, not `/products/search`).
11. Don't add dependencies beyond those named in `spec/ARCHITECTURE.md` without asking.

## Testing conventions

- Name tests after the spec ID they cover: `it('CAT-01: ties broken by rating count', …)`.
- Services are tested with `FixtureProductSource` and an in-memory recording notifier — real ports, deterministic data.
- **No live network calls in tests.** Fake Store adapter tests use MSW with recorded responses.
- Cover the error paths the spec names (404 vs 502, validation errors, email failure), not just the happy path.

## Working style

- One plan task per commit. Commit message starts with the task ID: `P3.4: category page split and ranking`.
- Keep changes scoped to the task; don't refactor unrelated code.
- TypeScript strict mode is on; don't weaken it or use `any` / non-null assertions to silence errors — fix the type.
- Never commit secrets or `.env`; add new settings to `.env.example` with a safe default.
