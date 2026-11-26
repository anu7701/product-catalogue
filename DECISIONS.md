# Decisions & Assumptions

> **Status:** v3, final for submission — single source of truth for assumptions and decisions: requirements (A1–A46), detailed functional assumptions (NEW-01–NEW-49, §6), key technical decisions (§8) and the outcome of every spec-review item (§9a).
> **Source:** `Code Challenge - AI-Native Engineer.pdf`
> **Working documents:** [spec/FUNCTIONAL_SPEC.md](spec/FUNCTIONAL_SPEC.md) (features & acceptance criteria) · [spec/ARCHITECTURE.md](spec/ARCHITECTURE.md) (technical design) · [spec/IMPLEMENTATION_PLAN.md](spec/IMPLEMENTATION_PLAN.md) (phases and tasks) · [spec/SPEC_REVIEW.md](spec/SPEC_REVIEW.md) (review findings) · [spec/ACCEPTANCE_RESULTS.md](spec/ACCEPTANCE_RESULTS.md) (acceptance run)

---

## 1. What we are building (in one paragraph)

A **proof-of-concept product catalogue** for an entrepreneur. Customers can browse a curated home page, browse by category, search, view a product, and send an enquiry about a product to the sales team by email. It is **not a throwaway**: the product data source, the look and feel, and the email provider are all expected to change, so the PoC must be a foundation that can grow rather than a demo.

## 2. Who is who

| Term in the criteria | Interpreted as |
|---|---|
| "I" in *"I have chosen 5 products"* | The **store owner** (the entrepreneur), not the customer. |
| "I" in every other criterion | An **anonymous customer** browsing the site. |
| "Sales inbox" | A single email address owned by the business, set by configuration. |

## 3. Guiding principles for assumptions

When the criteria are unclear, choose the option that:

1. **Satisfies the acceptance criterion literally and simply** — this is a PoC, critical path first.
2. **Does not lock the business in** — anything the brief says will change (data, branding, email) must be replaceable without touching the rest.
3. **A reviewer can verify locally in < 10 minutes** with no paid services or accounts.
4. **Can be explained and defended** in one or two sentences.

---

## 4. Assumptions per acceptance criterion

### 4.1 Home page — featured "top rated" products

> GIVEN I have chosen 5 products to be "top rated" / WHEN I am viewing the home page / THEN I see those 5 featured products

| ID | Assumption | Why |
|---|---|---|
| A1 | "Top rated" on the home page is an **owner-curated selection**, not computed from customer ratings. The quotes around "top rated" and the phrase "I have chosen" signal a label the owner applies. | Literal reading of the criterion. |
| A2 | For the PoC the owner chooses the 5 products via **configuration**: an ordered list of product IDs (e.g. `FEATURED_PRODUCT_IDS=3,7,12,1,18`). Changing it means editing the value and restarting/redeploying — in practice the developer does this on the owner's behalf. Later, an admin UI or CMS replaces the config; the page only asks for "the featured products", so only the source of that list changes. | An admin UI is a whole feature with auth; out of scope for a 2–3h PoC. The criterion only needs the owner's choice to drive the page, not the owner to pick on screen. |
| A3 | Products are shown **in the order the owner listed them**. | Curation implies order matters. |
| A4 | If a configured product no longer exists in the data source (a **stale ID** — see below), it is **skipped** and a warning is logged for the owner; the page does not break. We show up to 5, never pad with random products. | The data source is expected to change; a stale ID must not take the home page down. |
| A4a | **What "stale ID" means:** an ID stored somewhere (the featured config, or a bookmarked/shared product URL) that no longer matches a product in the data source — because the product was removed, or because the data source was replaced and its IDs look different (e.g. `7` → `SKU-1042`). Fake Store IDs (1–20) are fixed, so in the PoC this only happens via a config typo; after the data source swap it becomes a real case. | Makes A4 and A23 concrete and testable. |
| A5 | The home page also shows **links to every category** and the **search bar**, so it acts as the entry point to all other journeys. | Category criterion requires "a category link" to click; the home page is the natural place. |

### 4.2 Category page

> GIVEN my products are organised into categories / WHEN I click on a category link / THEN I see top rated products for that category AND I see additional products in that category

| ID | Assumption | Why |
|---|---|---|
| A6 | Categories come **from the product data source** (Fake Store has 4: electronics, jewelery, men's clothing, women's clothing). No owner-defined taxonomy in the PoC. | Metadata is "not important yet"; avoid inventing a taxonomy that will be replaced. |
| A7 | "Top rated products for that category" = the **highest customer-rated products in that category** (by average rating, ties broken by number of ratings). Shown as a distinct "Top rated" section at the top. | Unlike the home page, there is no "I have chosen" here, and curating per category would add owner effort with no admin UI. Customer rating data already exists. |
| A8 | The top rated section shows **up to 3** products. | Fake Store categories have only 4–6 products; 3 leaves room for "additional products" to be non-empty. Number is configurable. |
| A9 | "Additional products" = **all remaining products in the category**, with **no duplicates** of those in the top rated section. | Avoid showing the same tile twice. |
| A10 | No pagination, sorting or filtering on the category page. | ≤ 6 products per category; not in the criteria. Called out as a growth item. |
| A11 | An unknown category shows a friendly "category not found" state with links to the real categories, not an error page or an empty list. This can't happen through normal clicking (category links are built from existing categories); it happens via a **hand-typed/edited URL** (e.g. `/category/shoes`) or an **old bookmark/shared link after categories change** in the data source (e.g. Fake Store's `jewelery` renamed to `jewelry`, or men's/women's clothing merged). | Basic robustness; categories are owned by a data source we expect to replace. |

> **Note the tension (A1 vs A7):** "top rated" means *owner-curated* on the home page and *customer-rated* on the category page. This is deliberate and follows the wording of each criterion. Flagged as an open question for the entrepreneur (Q1).

### 4.3 Search

> GIVEN I am looking for a specific product AND I have entered a search term in the search bar / WHEN I click the search button / THEN I only see products that have text matching that search term

| ID | Assumption | Why |
|---|---|---|
| A12 | "Text matching" = **case-insensitive "contains" match** of the whole search term against the product **title, description and category**. | Most intuitive for a customer; broad enough to be useful, simple to explain. No fuzzy matching, stemming or ranking. |
| A13 | Leading/trailing whitespace is trimmed. An **empty search is not submitted** (button does nothing / shows a hint). | Prevents "search for nothing returns everything", which would violate "*only* see products matching". |
| A14 | Search runs across the **whole catalogue**, not within the current category. | Criterion does not mention categories. |
| A15 | Search is triggered by the **search button and by pressing Enter**. | Criterion requires the button; Enter is expected keyboard/accessibility behaviour. |
| A16 | Results appear on a **results page whose URL contains the term**, so it can be shared, bookmarked and reloaded. Results show the term and a count. | Low-cost, expected web behaviour. |
| A17 | **Zero results** shows a clear "no products match '…'" message with a route back to browsing. | The "only matching" rule makes empty results a real case. |
| A18 | Search is performed **by our backend, not the client**, since the data source has no search capability and the client must never talk to it directly. | Technical constraint #2; also keeps search swappable when the data source changes. |
| A19 | The search bar is available on **every page** (in the header). | "I am looking for a specific product" can happen from anywhere. |

### 4.4 Product page

> GIVEN I am browsing the products AND I want to see more details about a specific product / WHEN I click on a product tile / THEN I see the product details page

| ID | Assumption | Why |
|---|---|---|
| A20 | **Every product tile everywhere** (home, category, search) links to the product page. A tile shows image, title, price and rating. | "Browsing the products" covers all listing pages. |
| A21 | The product page shows: image, title, price, category (linked to the category page), description, rating (average + count), and the **Enquire** button. | Everything the data source offers that a customer would care about. |
| A22 | **Price is shown** (tile, product page, enquiry email), as provided by the data source, formatted as a **single currency (USD)**. It is **display only** — not a binding quote and not required to submit an enquiry. | The criteria are silent on price. Showing it helps customers decide whether to enquire and avoids low-value "how much?" enquiries; the data is already available; hiding it later is a small change. Fake Store prices have no currency, so USD is assumed. Whether the business will be quote-based ("Price on request") is open question Q7. |
| A23 | An unknown or stale product ID (see A4a) — e.g. opening a bookmarked `/product/7` after product 7 is gone — shows a friendly "product not found" state with a route back to browsing. | Data source is expected to change; links may go stale. |
| A24 | Each product page has its **own URL** so it can be shared and reloaded. | Expected web behaviour; useful for enquiry context. |

### 4.5 Enquiry

> GIVEN I am viewing a product … AND I click on the Enquire button AND I complete the subsequent form with my contact details / WHEN I submit the form / THEN the sales inbox will receive an email AND the customer will see a "Thank you" message

| ID | Assumption | Why |
|---|---|---|
| A25 | An enquiry is about **exactly one product** — the one being viewed. No cart / multi-product enquiry. | Criterion says "a product"; a cart is a different feature. |
| A26 | The form opens **on the product page** (inline or as a dialog), keeping the product visible as context. | "Subsequent form" after clicking Enquire; avoids losing context. |
| A27 | Form fields: **Name** (required), **Email** (required, valid format), **Phone** (optional), **Message** (optional, length-limited). | "Contact details" minimum is a way to reply; email is the universal one. Phone optional for businesses that call back. |
| A28 | The product's ID, title, price and link are **attached automatically** by the system — the customer does not type them, and the system does not trust product details sent from the browser. | Sales needs to know what was enquired about; prevents tampering. |
| A29 | Validation happens **in the browser (for UX) and on the server (for trust)**. Errors are shown per field and the customer's input is kept. | Security basics; good UX. |
| A30 | The email goes to a **single sales inbox address set by configuration**, with the customer's email as **reply-to**, so sales can just hit reply. | Simplest useful workflow; address and provider will change. |
| A31 | "Thank you" is shown **only after the email has been accepted for sending**. If sending fails, the customer sees an error and can retry, and their input is kept. | Showing "Thank you" when the email was lost would silently drop leads — the one thing this MVP must not do. |
| A32 | The "Thank you" message **replaces the form** on the same page and confirms which product it was about. | Clear confirmation; no extra page needed. |
| A33 | **No confirmation email to the customer** in the PoC. | Not in the criterion; can be added later with the same email capability. |
| A34 | Enquiries are **not stored** in a database for the PoC; the email in the sales inbox is the record. Enquiry handling is still modelled as **validate → record → notify**, where "record" is a no-op for now, so storage can be added in one place without touching the form or the email sending. | (1) The criterion's outcome is an email, not stored data. (2) A database adds schema, migrations and local setup — cost against the 2–3h time-box and the reviewer's 10-minute setup. (3) Storing names/emails/phones creates personal-data obligations (retention, access, deletion) the PoC can't answer properly; storing nothing is the safer default. (4) Lead loss is already mitigated by A31 — "Thank you" only after the email is accepted, otherwise the customer sees an error and can retry. **Revisit when:** the business wants enquiry history/status (CRM-like), wants customers never to see an email failure, or needs records for compliance/spam handling. See Next steps #1. |
| A35 | Locally, emails are delivered to a **local test mailbox the reviewer can open in a browser**, so the criterion is verifiable without any accounts or paid services. A real provider is a configuration change. | Constraints #4 and #6; the email provider is expected to change. |
| A36 | Basic abuse protection: input length limits and a simple **rate limit** on enquiry submission. No CAPTCHA. | Public form that sends email = spam target; CAPTCHA usually needs an account/key. |
| A37 | Customer data in the enquiry is used **only to send the email** and is not logged in full. | Privacy basics for personal data. |

---

## 5. Cross-cutting assumptions

| ID | Assumption | Why |
|---|---|---|
| A38 | **Customers are anonymous.** No sign-up, login, wishlist, cart, checkout or payment. | Not in the criteria; enquiry replaces purchase. |
| A39 | **Decided:** the client is a **web app**, not a native iOS/Android app. Layout across screen sizes (responsiveness) is **not specified** for the PoC; it belongs to the look-and-feel work that is still in progress (A40). | The entrepreneur can share a link to firm up the vision with no app store or installs; the reviewer can run it in < 10 minutes without Xcode/Android Studio; browsing, search, shareable links and a form are what the web does best, and no native-only feature (push, camera, offline) is needed. A native app can be added later on top of the same backend. Revisit if market research shows customers are app-first. |
| A40 | Look and feel is a **neutral placeholder** — creative work is in progress. Branding (colours, fonts, logo, name) must be changeable in one place. | Brief: look and feel will change. |
| A41 | Catalogue size is small (Fake Store: 20 products). **No pagination** anywhere for the PoC. | Matches the data; noted as a growth item. |
| A42 | Product data is **read-only** from the data source. No owner editing of products. | Metadata "not important yet". |
| A43 | Every page has a **loading state, an empty state and an error state**. If the product data source is down, the customer sees a friendly message, not a crash. | Third-party API; implementation quality criterion. |
| A44 | Basic **accessibility**: keyboard navigable, labelled form fields, image alt text (product title), sufficient contrast. | Low cost, expected baseline. |
| A45 | English only, single region, single currency. | Not in the criteria. |
| A46 | No analytics, SEO optimisation or cookie banner in the PoC. | Not on the critical path; no tracking means no consent needed. |

## 6. Detailed functional assumptions (NEW-xx)

Introduced while writing the functional spec to make rules specific enough to build and test. IDs keep their `NEW-` prefix so references in [spec/FUNCTIONAL_SPEC.md](spec/FUNCTIONAL_SPEC.md) stay stable. **Accepted** unless marked otherwise.

| ID | Assumption | Why | Status |
|---|---|---|---|
| NEW-01 | Category links appear in the header on every page. | A19 puts search everywhere; categories are the other main navigation. | Accepted |
| NEW-02 | Category labels: first letter capitalised, otherwise as provided. | Readability without inventing names. | Accepted |
| NEW-03 | Categories listed alphabetically. | Deterministic, testable order. | Accepted |
| NEW-04 | Rating shown as average (1 decimal) + count, e.g. `3.9 (120)`. | Consistent format; both values are meaningful. | Accepted |
| NEW-05 | Long titles truncated on tiles only. | Keeps the grid tidy; full text on product page. | Accepted |
| NEW-06 | Missing image → placeholder. | Data source may have broken images. | Accepted |
| NEW-07 | Missing rating → rating hidden; product excluded from category top rated. | Can't rank what isn't rated. | Accepted |
| NEW-08 | Price 0 is displayed, not hidden. | Hiding would misrepresent data. | Accepted |
| NEW-09 | Slow data source requests time out (5s) and show the error state. | Avoid infinite loading. | Accepted |
| NEW-10 | Malformed product records are skipped, valid ones shown. | One bad record shouldn't break a page. | Accepted |
| NEW-11 | Category pages have their own URL. | Consistency with A16/A24. | Accepted |
| NEW-12 | Unknown paths show a "page not found" page. | Basic robustness. | Accepted |
| NEW-13 | Trailing slash treated the same as none. | Avoid confusing not-found pages. | Accepted |
| NEW-14 | Validation errors and thank-you are announced to screen readers. | Accessibility baseline (A44). | Accepted |
| NEW-15 | Responsiveness. | — | **Withdrawn** (A39) |
| NEW-16 | Contrast meets WCAG 2.1 AA. | Concrete, testable version of A44. | Accepted |
| NEW-17 | No featured products available → featured section hidden; app still runs. | Home page must still work. | Accepted |
| NEW-18 | Partial data failure hides only the affected section/product. | Show what we can. | Accepted |
| NEW-19 | Final tie-break in category top rated: lower product ID first. | Deterministic order for testing. | **Under review** — conflicts with opaque string IDs (R-08). **Implemented meanwhile:** remaining ties keep data source order (stable sort), which works for any ID format |
| NEW-20 | Non-ranked lists (category "More in…", search results) use data source order. | No ordering requirement; simplest. | Accepted |
| NEW-21 | Category with ≤ 3 products: all in top rated, "More in…" hidden. | Avoids an empty section. | **Under review** (R-04). **Built as:** top rated shows up to the configured 3 regardless of category size, so a category of ≤ 3 rated products has no "More in…". Never happens with the current data (smallest category has 4) |
| NEW-22 | Existing category with 0 products → empty-state message. | Possible after data source changes. | Accepted — reachable: categories come from the source's own categories list (R-09 default), which can list a category with no products |
| NEW-23 | Category IDs (UUIDs) matched exactly; hex letters compared case-insensitively. | UUIDs are case-insensitive by definition. | Accepted — revised for UUID category IDs (T15) |
| NEW-24 | Search term max 100 characters. | Bounds input; enough for any product search. | Accepted |
| NEW-25 | Search bar pre-filled with current term on results page. | Lets customer refine the search. | Accepted |
| NEW-26 | `/search` with no/empty term shows "Enter a search term", no products. | Consistent with A13. | Accepted |
| NEW-27 | Search term is literal text; no wildcard/pattern characters. | Predictable; avoids injection-style surprises. | Accepted |
| NEW-28 | Enquire button visible without scrolling. | It is the page's main action. | Accepted |
| NEW-29 | Browser tab title includes product title. | Usability for tabs/bookmarks. | Accepted |
| NEW-30 | Closing the form keeps input while on the same product page. | Avoid losing typed text by accident. | Accepted |
| NEW-31 | Field limits: name 100, email 254, phone 7–20 allowed chars, message 1000. | Bound input (A36); 254 is the email standard max. | Accepted |
| NEW-32 | Line breaks rejected in name and email. | Prevents email header injection. | Accepted |
| NEW-33 | Email checked for format only, not deliverability. | No external checks / accounts. | Accepted |
| NEW-34 | Form inputs trimmed before validation. | Whitespace-only = empty. | Accepted |
| NEW-35 | Browser validation on submit and on leaving an edited field. | Common, non-intrusive pattern. | Accepted |
| NEW-36 | Enquiry for a product that no longer exists is rejected with a message. | System attaches product details (A28) and can't for a missing product. | Accepted |
| NEW-37 | Email content, subject format and configurable sender address as in FUNCTIONAL_SPEC ENQ-03.FR1. | Sales needs enough to act without opening the site. | Accepted |
| NEW-38 | Send button disabled while sending. | Prevent duplicate emails. | Accepted |
| NEW-39 | No de-duplication of separate enquiries. | Customer may genuinely enquire twice. | Accepted |
| NEW-40 | Thank-you wording as in FUNCTIONAL_SPEC ENQ-04.FR1. | Confirms name, product and reply address. | Accepted |
| NEW-41 | After thank-you, Enquire not shown until page revisit. | Avoid accidental repeat enquiries. | Accepted |
| NEW-42 | Rare duplicate email on network failure + retry accepted in PoC. | Fix requires storage (Next step #1). | Accepted |
| NEW-43 | Rate limit: 5 per 15 min per network address, configurable; shared networks may share a limit. | Concrete values for A36. | Accepted |
| NEW-44 | Every submission attempt counts towards the rate limit. | Also limits probing with invalid data. | Accepted |
| NEW-45 | Featured config: whitespace and empty entries ignored. | Forgiving manual editing. | Accepted |
| NEW-46 | Featured config: duplicates removed, max first 5 used, warnings logged. | AC says 5; config mistakes shouldn't break the page. | Accepted |
| NEW-47 | Example config ships with 5 valid Fake Store IDs (also present in the fixture data). | Reviewer sees a working home page immediately. | Accepted |
| NEW-48 | Missing/invalid sales inbox or sender address stops the app from starting. | Accepting undeliverable enquiries would lose leads. | Accepted |
| NEW-49 | README states the local test mailbox address. | Reviewer can verify enquiry within 10 minutes. | Accepted |

## 7. Things that are expected to change (must be swappable)

Stated in the brief, so treated as requirements, not nice-to-haves:

1. **Product data source** — Fake Store today; a real catalogue/CMS/database later. Nothing outside one boundary should know it is Fake Store.
2. **Look and feel** — placeholder today; the creative agency's design later.
3. **Email provider** — local test mailbox today; a real provider later.
4. **The "top rated" home selection** — config today; owner-managed later.
5. **Sales inbox address** — config.

## 8. Key technical decisions

Full reasoning and alternatives: [spec/ARCHITECTURE.md §15](spec/ARCHITECTURE.md#15-summary-of-key-trade-offs).

| # | Decision | Why (short) |
|---|---|---|
| T1 | React + Vite single-page app; no server-side rendering | Clean frontend/backend boundary; SEO out of scope (A46) |
| T2 | Node.js + TypeScript + Fastify API | Allowed by the brief; built-in structured logging, validation and fast HTTP tests |
| T3 | Ports & adapters: `ProductSource`, `Notifier`, `EnquiryRecorder` | The data source and email provider are expected to change (§7) |
| T4 | **No caching** — every request reads from the product source | Simplest, always-current, easy to test; caching is a later add-on behind the port |
| T5 | Business rules in API services; purpose-built endpoints | One tested place; reusable by a future native app |
| T6 | **No database** | No criterion needs stored data; avoids personal-data obligations (A34) |
| T7 | Email over SMTP (Nodemailer); Mailpit locally, SES on AWS | Provider swap is configuration; reviewer verifies without accounts (A35) |
| T8 | Product images proxied through the API | Browser never calls Fake Store (constraint 2) |
| T9 | Shared Zod schemas between web and API (npm workspaces; separate `package.json` per app) | Same validation rules and messages in browser and server (A29) |
| T10 | CSS Modules + design tokens | Easy hand-off to the creative re-skin (A40) |
| T11 | AWS target: CloudFront + S3 (web), ECS Fargate (API), SES — designed, not built | Container parity with local; AWS-compatible (constraint 3) |
| T12 | `202 Accepted` for enquiries | Email accepted for sending, nothing stored |
| T13 | **Second product source: committed JSON fixture** (`PRODUCT_SOURCE=fakestore\|fixture`) | Runs offline if Fake Store is down; deterministic tests; proves the data source is swappable |
| T14 | API routes `/products?q=` (search) and `/featured-products` | Avoids collisions with opaque product IDs under `/products/{id}` |
| T15 | **Category IDs are UUID v5**, derived from the source category name in a fixed namespace; URLs are `/category/{uuid}` | Consistent opaque IDs; deterministic so links survive restarts (random v4 would not). Trade-off: URLs are not human-readable, and renaming a category in the source changes its ID |
| T16 | **API runs TypeScript natively in Node** (type stripping); no compile/bundle step. Imports use `.ts` extensions; only erasable TS syntax (no `enum`) | One less tool and build stage; dev and production run the same files. Trade-off: requires Node ≥ 24 and forbids a few TS features |

## 9. Dropped or simplified (and why)

| Item | Decision | Why |
|---|---|---|
| Owner admin UI for choosing top rated products | **Simplified** to configuration (A2) | Needs auth + UI; criterion is met as long as the owner's choice drives the page. |
| Per-category curated "top rated" | **Simplified** to customer rating (A7) | No admin UI; rating data already exists. |
| Enquiry storage / CRM | **Dropped** (A34) | Email is the stated outcome. |
| Customer confirmation email | **Dropped** (A33) | Not in the criterion. |
| Pagination, sorting, filters | **Dropped** (A10, A41) | 20 products. |
| Fuzzy / ranked search | **Simplified** to contains-match (A12) | Predictable and testable; easy to upgrade later. |
| Native mobile app | **Not chosen** (A39) | One client allowed; web is shareable by link and fastest to run. |
| Responsive / multi-device layout | **Dropped from spec** (A39) | Visual layout is owned by the creative work in progress; not in the criteria. |
| Caching (server, HTTP, CDN) | **Deferred** (T4) | Keeps the PoC simple and always current; the fixture source covers upstream outages for the reviewer. First step when traffic or resilience matters. |
| Database | **Dropped** (T6, A34) | Nothing needs persisting yet. |
| Authentication / authorization | **Dropped** (A2, A38) | Customers are anonymous; no admin surface. The only write endpoint is the rate-limited enquiry. |
| AWS deployment / infrastructure as code | **Designed, not built** (T11) | Time-box; the brief only requires AWS compatibility. Local run is Docker Compose. |
| Monitoring / tracing | **Simplified** to structured logs + health check | Enough at this size; no accounts needed. |
| Automatic email retry | **Dropped** (A31, NEW-42) | Needs stored enquiries (Next step #1); the customer retries instead. |
| CAPTCHA / WAF | **Dropped** (A36) | Needs third-party accounts; rate limit + validation instead. |
| Enquiry form as a dialog | **Simplified** to an inline form (A26) | No focus trapping or Escape handling needed; the product stays visible. |
| Live manual visual QA | **Not done** | Journeys are verified by component tests and a Playwright suite in Chromium against the Docker stack (spec/ACCEPTANCE_RESULTS.md); nobody has reviewed the look by eye. The look is a placeholder anyway (A40). |
| One assessed PR for all the work | **Changed** to one PR per phase (#1–#9, merged), plus the open final PR | Smaller, reviewable steps; the final PR links each phase. |

## 9a. Spec review items: outcomes

From [spec/SPEC_REVIEW.md](spec/SPEC_REVIEW.md), as built.

| Item | Outcome |
|---|---|
| R-01 Live Fake Store dependency | **Resolved:** offline fixture source (T13); CI and tests use it |
| R-02 Cache contradicted the spec | **Resolved** by not caching (T4) |
| R-03 Route collisions with product IDs | **Resolved:** `/products?q=`, `/featured-products` (T14) |
| R-04 Category "additional products" vs top-rated count | **Deferred:** current spec behaviour built behind one `topRatedLimit()` function; can't occur with current data (NEW-21) |
| R-05 Scope vs time-box | **Accepted:** the full P0/P1 scope was built; nothing from the proposed cut list needed cutting |
| R-06 "Top rated" means two things | **Open** (Q1): home heading kept as the spec says ("Top rated") |
| R-07 Rate-limit bypass via X-Forwarded-For | **Resolved:** trusted hop count, not `true`; Nginx replaces the header; tested end to end |
| R-08 Tie-break with string IDs | **Resolved** with the default: remaining ties keep source order (NEW-19) |
| R-09 Category identity | **Resolved:** UUID v5 IDs (T15); category list from the source's categories call |
| R-10 DECISIONS.md not the source of truth | **Resolved** (this document) |
| R-11 SMTP "accepted" ≠ delivered; SES prerequisites | **Open:** "Thank you" means the mail server accepted it; SES setup is a next step |
| R-12 Featured-ID warning logged on every request | **Open** (accepted for the PoC) |
| R-13 IP addresses in logs; Mailpit exposure | **Partly resolved:** all ports bound to 127.0.0.1; request logs still include client IPs |
| R-14 Over-long search term; API paths served as SPA | **Resolved:** search page checks the term first; Nginx never serves the SPA for `/api/` |
| R-16 In-memory rate limit with several instances | **Open:** fine for one instance; shared store before scaling out |
| R-17 Authorization statement | **Resolved:** the enquiry POST is the only write endpoint (§9) |
| R-18 Image proxy limits | **Resolved:** host allow-list, no redirects, `image/*` only, 5 MB cap, timeout |
| R-20 Undocumented prerequisites | **Resolved:** README prerequisites |
| R-22 Only CR/LF rejected | **Open:** other control characters are allowed in names |
| R-25 Response shape gaps | **Resolved:** `category` is a `Category`; 429 includes `Retry-After` |
| R-15, R-19, R-21, R-23, R-24 | Minor; R-24 no longer applies (no cache); the rest accepted as noted in the review |

## 10. Open questions for the entrepreneur

Recorded rather than asked (per the brief), to revisit once the PoC is in their hands:

- **Q1.** Should "top rated" on category pages also be hand-picked by you, or is customer rating the right signal?
- **Q2.** What does sales need in the enquiry beyond name, email, phone and message (e.g. quantity, company, preferred contact time)?
- **Q3.** Should customers get a confirmation email, and should enquiries be kept somewhere other than the inbox?
- **Q4.** Which currency/currencies and regions will you sell in?
- **Q5.** How will you want to manage the featured products day-to-day (who, how often)?
- **Q6.** Any privacy/consent wording required on the enquiry form for your market?
- **Q7.** Will prices be public, or is the business quote-based ("Price on request")? The PoC shows prices (A22); the price stays in the sales email either way as context.

---

## 11. How the design supports growth beyond the PoC

See [spec/ARCHITECTURE.md](spec/ARCHITECTURE.md) for detail. In short, each thing the brief says will change sits behind one boundary:

- **Product data source** → a `ProductSource` port in the API. The PoC already has two adapters (Fake Store and a JSON fixture), so a real catalogue is a third adapter; services, routes and the UI don't change.
- **Caching** → when needed, added as a wrapper around `ProductSource`; nothing else changes.
- **Email provider** → a `Notifier` port over SMTP; Mailpit locally, SES on AWS, any provider by config.
- **Look and feel** → design tokens and presentational components in the web app; pages and data fetching don't change.
- **Enquiry storage** → an `EnquiryRecorder` port already in the flow (no-op today) for Next step #1.
- **New clients** → business rules live server-side behind a versioned REST API, so a native app can reuse them.

## 12. What I would do next with another day

1. **Persist enquiries and send email in the background with retries** (revisits A34). Save every enquiry first, show "Thank you" once it is saved, then send the email separately and retry on failure. This removes the one case where a customer sees an error because the email provider is down, and gives the business an enquiry history. Needs a retention/deletion policy for the personal data stored.
2. **Add catalogue caching** (revisits T4) as a wrapper around `ProductSource`: short-lived in-memory copy, serve last-known data if the source fails. Reduces upstream calls and keeps the site up during Fake Store outages.
3. **Settle the open product questions with the entrepreneur:** Q1/R-06 (one meaning for "top rated"), R-04, Q6 (privacy notice on the form, a launch blocker), Q7 (public prices).
4. **Deploy to AWS with infrastructure as code** (CDK): ECS Fargate + CloudFront/S3 + SES as designed (ARCHITECTURE §12.2), including SES domain verification and bounce handling (R-11), and a shared rate-limit store or WAF rules before running more than one API instance (R-16).
5. **Apply the creative work:** real design tokens and a responsive layout, with a visual and accessibility review in real browsers.
6. **Logging hygiene:** drop or truncate client IPs in request logs (R-13); log each stale featured ID once per refresh rather than per request (R-12).

## 13. Time spent

> **TO FILL IN before submitting** (the challenge asks for actual time; going over the 2–3 h time-box is fine if stated honestly).

| Activity | Time |
|---|---|
| Planning (requirements, assumptions, spec, architecture, review, plan) | _TBD_ |
| Building | _TBD_ |
| Testing | _TBD_ |
| Reviewing (AI output, PRs, docs) | _TBD_ |
| **Total** | _TBD_ |
