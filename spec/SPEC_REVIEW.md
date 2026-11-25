# Specification Review

> **Scope:** [DECISIONS.md](../DECISIONS.md), [FUNCTIONAL_SPEC.md](./FUNCTIONAL_SPEC.md), [ARCHITECTURE.md](./ARCHITECTURE.md)
> **Reviewer stance:** senior architect, before implementation starts
> **Status:** partially actioned — see resolution log

## Resolution log

| Issue | Outcome |
|---|---|
| R-01 | **Resolved** — `FixtureProductSource` added as a second product source (ARCH §3.6, T13). Rewriting data-dependent ACs against the fixture (part of R-19) not done yet. |
| R-02 | **Resolved differently** — caching removed from the architecture for now (ARCH §3.5, T4), so the cache/spec contradictions no longer apply. Caching is a next step. |
| R-03 | **Resolved** — `/products?q=` and `/featured-products` (ARCH §6.2, T14). |
| R-04 | **Deferred** — to be decided later; NEW-21 marked under review. |
| R-09 | **Partly resolved** — category ID is a deterministic UUID v5 of the source name (T15), so raw names no longer appear in URLs and NEW-23 is revised. Still open: derive categories from products vs a categories endpoint (NEW-22). |
| R-10 | **Resolved** — DECISIONS.md moved to repo root, NEW-xx merged with status, cut list extended, key technical decisions added. |
| Others | Open — not yet actioned. |

## Severity scale

| Severity | Meaning |
|---|---|
| **Critical** | Will cause a failed acceptance criterion, a broken reviewer run, or a design defect that is expensive to undo. Fix before building. |
| **High** | Real contradiction, security gap or ambiguity a developer/QA would hit. Fix before building. |
| **Medium** | Gap that should be documented or tightened; cheap to fix now. |
| **Low** | Nit / polish / note for later. |

## Summary

| # | Severity | Category | Issue |
|---|---|---|---|
| R-01 | Critical | Undocumented dependency · Unclear AC | Everything depends on the live Fake Store API; no offline/fixture source |
| R-02 | Critical | Contradiction | Architecture's catalogue cache contradicts several functional rules and ACs |
| R-03 | Critical | API inconsistency | `/products/featured` and `/products/search` collide with `/products/{id}` |
| R-04 | Critical | Contradiction | Category AC "I see additional products" can fail by our own rules |
| R-05 | Critical | Unnecessary complexity | Spec scope exceeds the 2–3h time-box |
| R-06 | High | Contradiction · Business rule | "Top rated" shown to customers with two different meanings |
| R-07 | High | Security | `TRUST_PROXY=true` lets clients spoof their IP and bypass the rate limit |
| R-08 | High | Contradiction | Tie-break "lower ID first" conflicts with opaque string IDs |
| R-09 | High | Data integrity · API | Category identity is defined two ways; raw names used in URLs |
| R-10 | High | Documentation integrity | DECISIONS.md is stale and not the single source of truth |
| R-11 | Medium | Unclear AC · Dependency | "Sales inbox will receive" vs "accepted for sending"; SES prerequisites missing |
| R-12 | Medium | Missing business rule | Featured list: cap vs stale ordering undefined; warning log spam |
| R-13 | Medium | Security · Privacy | IP addresses are personal data; privacy notice; Mailpit exposure |
| R-14 | Medium | Missing edge cases | Over-long `q` via URL; unknown `/api/*` paths served as SPA |
| R-15 | Medium | Contradiction | CFG-04 says "restart", architecture needs a rebuild |
| R-16 | Medium | Scalability | In-memory rate limiter and cache vs "≥ 2 ECS tasks" |
| R-17 | Medium | Missing authorization | No explicit authorization statement / API write-surface rule |
| R-18 | Medium | Unnecessary complexity | Image proxy scope not bounded |
| R-19 | Medium | Unclear AC | Several ACs not objectively testable |
| R-20 | Medium | Undocumented dependencies | Tooling/environment prerequisites for the reviewer |
| R-21 | Low | Data quality | Source typo "Jewelery" shown to customers |
| R-22 | Low | Security | Only CR/LF rejected; other control characters allowed |
| R-23 | Low | Missing NFRs | No browser-support or performance targets |
| R-24 | Low | Reliability | Cold start: first request pays for catalogue load |
| R-25 | Low | API inconsistency | Small response-shape gaps (`category` type, `Retry-After`) |

---

## Critical

### R-01 — Live Fake Store dependency; no offline/fixture data source
**Where:** ARCH §3.5, §11, §12.1; every data-dependent AC in FUNCTIONAL_SPEC.
**Issue:**
- The reviewer's < 10-minute run requires Fake Store to be up and reachable from inside Docker. It's a free service with no SLA; if it's down (or blocks the request) on review day, the whole PoC looks broken.
- Many ACs are written against live data ("the 3 highest-rated electronics products", search "backpack", "product 1 title"). QA can't write stable expected results, and E2E tests become flaky.
- This dependency (internet access, third-party uptime) isn't listed anywhere.

**Recommendation:**
- Add a second `ProductSource` adapter: **fixture source** loading a committed JSON snapshot of the Fake Store catalogue. Selected via `PRODUCT_SOURCE=fakestore|fixture`.
- Default stays `fakestore` (meets the brief); README documents the fallback. Tests and E2E use the fixture.
- Rewrite data-dependent ACs against the fixture data (exact IDs/titles/expected results).
- Bonus: this *demonstrates* the swappable data source rather than just claiming it — strong interview talking point.

### R-02 — Catalogue cache contradicts functional rules
**Where:** ARCH §3.5 (whole-catalogue cache, TTL, stale-while-error) vs FUNC GLB-03 AC, HOM-01 NEW-18, A4, NEW-36, ENQ-03.FR1 (price "at time of submission").
**Issue:** The spec was written as if every request hits the data source; the architecture serves from a snapshot. Consequences not reflected in the spec:
- GLB-03 AC ("data source unavailable → error state") is only true on a cold start; otherwise stale data is shown. QA can't reproduce it as written.
- NEW-18 (one product fails, others shown) can't happen — the snapshot loads all or nothing.
- A product removed upstream stays visible, featured and **enquirable** for up to the TTL; NEW-36 rejection is delayed.
- The email price is the cached price, not necessarily the current one.

**Recommendation:**
- Add a functional rule: "Product data may be up to N minutes old (default 5)." Record as an assumption.
- Rewrite GLB-03 AC: "GIVEN the data source is unavailable AND no product data has been loaded yet…", plus a second AC for serving last-known data.
- Remove NEW-18 (unreachable).
- Reword NEW-36 / ENQ-03.FR1 to "per the current catalogue snapshot".

### R-03 — Route collision on `/api/v1/products/*`
**Where:** ARCH §6.2.
**Issue:** `GET /products/featured` and `GET /products/search` share a path level with `GET /products/{id}`. IDs are opaque strings (A4a), so a product whose ID is `featured` or `search` (plausible with a real CMS) becomes unreachable. Static-route priority hides this today.

**Recommendation:**
- Search → `GET /api/v1/products?q={term}` (filtering the collection is idiomatic REST).
- Featured → `GET /api/v1/featured-products` (it's an owner-curated list, a separate resource).
- Leave `/products/{id}` and `/products/{id}/image` as the only per-ID routes.

### R-04 — Category AC can fail by our own rules
**Where:** Challenge AC "AND I see additional products in that category"; FUNC CAT-01 BR3 (configurable N) and BR8 (≤ 3 products → "More in" hidden).
**Issue:** If a category has ≤ N products, or N is configured ≥ category size, the "additional products" section is empty/hidden and the AC fails. We introduced this.

**Recommendation:** Top rated count = `min(N, products in category − 1)`, so whenever a category has ≥ 2 products at least one appears under "More in…". A single-product category shows it under top rated only; document that as the one accepted exception. Replace BR8 / NEW-21 accordingly.

### R-05 — Spec scope exceeds the time-box
**Where:** FUNC §9 (49 new assumptions), P1 list; ARCH §11 (E2E, CI), §10.3 (image proxy).
**Issue:** The brief explicitly rewards "a small, well-reasoned solution" and a 2–3h time-box. The spec now asks for many niceties that each cost time and tests: trailing-slash handling (NEW-13), tab titles (NEW-29), retained input on close (NEW-30), blur-time validation (NEW-35), character counter, dialog-or-inline choice, case-insensitive category URLs (NEW-23), Playwright E2E + CI, branding config. Risk: core P0 paths are under-tested or the time-box is blown.

**Recommendation:**
- Re-tier: P0 = the five ACs + constraints + their error states; everything else P1/P2 with an explicit **cut list** in DECISIONS.md (the brief asks for "requirements you dropped or simplified, and why").
- Proposed cuts/deferrals: NEW-13, NEW-23 (made moot by R-09), NEW-29, NEW-30, NEW-35 (validate on submit only), character counter, E2E (keep as "next step" unless time remains), CI (nice if 10 min), CFG-04 beyond store name.
- Fix the enquiry form as **inline** (no dialog) — less focus/escape handling.

---

## High

### R-06 — "Top rated" means two things to customers
**Where:** A1 vs A7; FUNC HOM-01 heading "Top rated", CAT-01 "Top rated in {category}".
**Issue:** On the home page "top rated" = owner's pick; on category pages = customer rating. A customer can see a 2.1-rated product labelled "Top rated" on the home page. Note the AC itself says *"THEN I see those 5 **featured** products"* — the quotes around "top rated" describe the owner's label, not a customer-facing promise.

**Recommendation:** Label the home section **"Featured"** (matching the AC's own word), keep "Top rated in {category}" for the rating-based section. Internally keep the name "featured" everywhere (config, API, code). Mostly resolves open question Q1.

### R-07 — Rate limit bypass via `X-Forwarded-For` spoofing
**Where:** ARCH §3.6 (`TRUST_PROXY=true`), §10.1.
**Issue:** "Trust all proxies" makes the client IP the left-most `X-Forwarded-For` entry, which the client controls. Anyone can rotate fake IPs and bypass the enquiry rate limit (spam to the sales inbox). On AWS there are two hops (CloudFront → ALB).

**Recommendation:** Configure trust by **hop count** (1 locally behind Nginx, 2 behind CloudFront + ALB) or by trusted CIDRs, never `true`. Make the API container unreachable except via the proxy (already true in compose — state it as a constraint). Add an integration test: spoofed header does not change the rate-limit key.

### R-08 — Tie-break by "lower product ID" vs opaque string IDs
**Where:** FUNC CAT-01 BR2 / NEW-19 vs A4a, ARCH §3.2 (IDs are strings).
**Issue:** With string IDs, "lower" is ambiguous (`"10" < "9"` as text). Different implementations will order differently; QA expectations break when the data source changes.

**Recommendation:** Final tie-break = **data source order** (stable sort). No assumption about ID format. Update NEW-19.

### R-09 — Category identity defined two ways; raw names in URLs
**Where:** FUNC §0.3 ("distinct values present on products"); ARCH §3.3 (`ProductSource.listCategories`), §6.2 (`slug` = raw value); FUNC NEW-22, NEW-23, GLB-04 example `/category/men's%20clothing`.
**Issue:**
- Contradiction: categories are either derived from products or fetched from a categories endpoint; the two can disagree.
- NEW-22 ("category exists with 0 products") is impossible if categories are derived from products — dead rule.
- Raw names with spaces/apostrophes in URLs are fragile; a category containing `/` would break routing (proxies decode `%2F`). NEW-23 (case-insensitive matching) only exists to paper over this.

**Recommendation:**
- Derive categories **from the product snapshot only**; drop `listCategories` from the port and drop NEW-22.
- Generate a URL-safe **slug** in the service (`men's clothing` → `mens-clothing`), keep the display `name` separately; look up by exact slug. Drop NEW-23.
- Slugs are derived from the source name, so a renamed source category still breaks old links — that's the accepted CAT-02 case.

### R-10 — DECISIONS.md is stale and not the source of truth
**Where:** DECISIONS.md header ("requirements only, tech deferred"), §7 cut list, vs FUNC §9 (49 unmerged NEW-xx), ARCH §15.
**Issue:** DECISIONS.md is an **assessed deliverable**. Right now assumptions live in two documents, its status line is wrong, its cut list misses architecture cuts (no DB, no auth, no IaC, one E2E), and the challenge expects it at repo root or in the README — ours is under `spec/`.

**Recommendation:** After this review: merge accepted NEW-xx into DECISIONS.md (or reference them explicitly), update status, extend the cut list, add key technical decisions (link to ARCH §15). Put `DECISIONS.md` at repo root (or link it prominently from README) and keep `spec/` for the working documents.

---

## Medium

### R-11 — "Inbox will receive" ≠ "accepted for sending"
**Where:** Challenge AC; A31; ENQ-03/04; ARCH §3.6, §12.2.
**Issue:** SMTP acceptance doesn't guarantee delivery (bounces, spam filtering). On AWS, SES starts in **sandbox** (only verified recipients) and needs a verified sender domain (SPF/DKIM) — undocumented prerequisites. Only failures *at send time* are alarmed.

**Recommendation:** State in DECISIONS that the PoC guarantees acceptance by the mail server, verified end-to-end locally via Mailpit. Add SES prerequisites (sandbox exit, domain verification, bounce/complaint notifications) to the AWS section and to "next steps".

### R-12 — Featured list: cap vs stale order undefined; log spam
**Where:** CFG-01 BR6 / NEW-46, HOM-01 BR4.
**Issue:** If 6 IDs are configured and one of the first 5 is stale, does the 6th fill in? The spec says cap first ("first 5") and "never pad" — but it isn't stated explicitly, and an owner listing 6 might expect a backup. Also, stale-ID warnings are logged on **every** home page view.

**Recommendation:** State explicitly: cap to the first 5 at startup; stale entries are not backfilled. Log `featured.id_missing` once per catalogue refresh, not per request.

### R-13 — Personal data beyond the form
**Where:** A37, ENQ-06 (rate limit by IP), ARCH §9.1, §12.1.
**Issue:**
- IP addresses are personal data (e.g. under GDPR); the rate limiter holds them and default request logs include them. The spec says "no personal data in logs".
- No privacy notice on the enquiry form (Q6) — fine for a demo, a blocker before real customers.
- Mailpit UI is published on all interfaces; anyone on the same network can read captured enquiries.

**Recommendation:** Either drop/truncate IPs in logs or explicitly allow them with a retention note; keep the limiter in memory only. Mark privacy notice as a **pre-launch blocker** in next steps. Bind Mailpit (and the web port) to `127.0.0.1` in compose.

### R-14 — Missing edge cases at the edges of routing/validation
**Where:** SRC-01 BR4, NEW-26; ARCH §6.2, §12.1.
**Issue:**
- `/search?q=<101+ chars>` opened directly: API returns 400, but no UI behaviour is specified.
- Nginx's SPA fallback could serve `index.html` for unknown `/api/*` paths, returning HTML with 200 to API clients.

**Recommendation:** Specify: over-long `q` from URL → show "Search term is too long (max 100 characters)" with the bar pre-filled (truncated). Constraint: `/api/*` never falls back to the SPA; unknown API paths return a Problem Details 404.

### R-15 — Branding: "restart" vs "rebuild"
**Where:** FUNC CFG-04 AC vs ARCH §2.4.
**Issue:** The AC says the new store name appears after a restart; the architecture makes it a build-time value.

**Recommendation:** Change the AC to "after rebuilding/redeploying the web app" (and it's P2 — candidate to cut, see R-05).

### R-16 — In-memory state vs multi-instance AWS target
**Where:** ARCH §12.2 (≥ 2 ECS tasks), §3.5, §10.1, §13.
**Issue:** With 2+ tasks, the rate limit is effectively ×N and each task has its own catalogue snapshot (two requests can see different data during a refresh window). §13 mentions Redis for the limiter but the deployment diagram doesn't.

**Recommendation:** Add to ARCH §12.2: rate limiting moves to AWS WAF rate-based rules or a shared store before running > 1 task; snapshot divergence ≤ TTL is accepted. No change for the PoC.

### R-17 — Authorization requirements not stated explicitly
**Where:** ARCH §5; FUNC roles.
**Issue:** "No auth" is decided, but the spec never states the resulting rules QA/security can check: what the public write surface is, and who effectively has owner power.

**Recommendation:** Add explicit statements: (1) the only state-changing endpoint is `POST /enquiries`; no other write endpoints may exist without an auth decision; (2) owner/operator authority = access to deployment configuration/secrets; (3) Mailpit and any debug tooling are never deployed beyond local; (4) Sales Team has no system access in the PoC.

### R-18 — Image proxy scope unbounded
**Where:** ARCH §10.3, §6.2.
**Issue:** The proxy is justified (constraint 2), but its behaviour isn't specified: upstream timeout, content-type allow-list, max size, caching, behaviour on failure. Without limits it's both a time sink and an abuse vector (large/slow upstream responses).

**Recommendation:** Keep it, but minimal: stream through, allow only `image/*`, cap size (e.g. 5 MB), same upstream timeout, `Cache-Control: public, max-age=86400`, 404/502 → frontend shows placeholder (NEW-06). No resizing/transforms.

### R-19 — Acceptance criteria not objectively testable
**Where:** GLB-03.FR4 ("reasonable time"), GLB-05 (WCAG AA — how verified?), ENQ-03 AC (`<product 1 title>`), CAT-01 AC (live data), GLB-02 AC (example values may not exist).
**Issue:** QA can't derive a pass/fail without interpretation.

**Recommendation:** Pull the 5s timeout into the functional spec; define accessibility verification (automated axe check on each page + one manual keyboard pass); rewrite data-dependent ACs against the fixture dataset (R-01).

### R-20 — Undocumented environment dependencies
**Where:** ARCH §12.1, README (future).
**Issue:** Not stated: Docker Desktop / Compose v2 minimum version (optional `env_file` needs a recent Compose), free ports 8080/8025, outbound internet (R-01), Node LTS version for dev mode, Docker build context must be the repo root (workspaces + shared package).

**Recommendation:** Add a "Prerequisites" list to ARCH §12.1 (and later the README). Prefer defaults inside `docker-compose.yml` so no `.env` is required at all.

---

## Low

### R-21 — "Jewelery" typo shown to customers
Fake Store's category is misspelled; NEW-02 only capitalises it. **Recommend:** accept for PoC (metadata "not important yet") and note it; optionally a display-name map in the adapter — not worth it now.

### R-22 — Only CR/LF rejected in single-line fields
Other control characters (NUL, U+2028/2029, tabs) can still corrupt email rendering or logs. **Recommend:** reject all control characters in name/email/phone; allow only `\n` in message.

### R-23 — No non-functional targets
No supported-browser list or performance targets. **Recommend:** "latest two versions of Chrome, Firefox, Safari, Edge"; API p95 < 300 ms from warm cache (local). Informative, not gating.

### R-24 — Cold start
First request triggers the catalogue load (up to the 5s timeout). **Recommend:** warm the cache at startup; health check reports ready only after the first load attempt (don't block startup on failure).

### R-25 — Small API shape gaps
Category endpoint's `category` field type is unspecified (string vs `{slug, name}`); 429 responses should include `Retry-After`. **Recommend:** `category: Category`; add `Retry-After`.

---

## Recommended order of changes

1. **Decide:** R-06 (label "Featured"), R-04 (min rule), R-09 (slugs, derived categories), R-03 (routes), R-08 (tie-break) — small decisions, unblock everything else.
2. **Design:** R-01 (fixture source), R-02 (staleness rule), R-07 (proxy trust), R-18 (proxy limits).
3. **Trim:** R-05 cut list.
4. **Consolidate:** R-10 — merge into DECISIONS.md, then fix remaining Medium/Low items in passing.
