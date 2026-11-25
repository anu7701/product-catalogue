# Functional Specification — Product Catalogue PoC

> **Status:** Draft v1
> **Based on:** [DECISIONS.md](../DECISIONS.md) (approved requirements brief, assumptions A1–A46 and NEW-01–NEW-49) and `Code Challenge - AI-Native Engineer.pdf`
> **Audience:** developers implementing the PoC and QA testing it
> **Out of scope for this document:** technology, architecture and code. This describes *what* the system does, not *how*.

---

## 0. How to read this document

### 0.1 Conventions

- **Feature IDs** are `<MODULE>-<NN>` (e.g. `SRC-02`). Requirements inside a feature are `<FEATURE>.FR<n>` (e.g. `SRC-02.FR3`) so QA can trace each test to a line.
- **Rule sources** are tagged on every business rule:
  - `[AC]` — stated directly in the challenge's acceptance criteria or technical constraints.
  - `[Axx]` — an approved assumption from DECISIONS.md.
  - `[NEW-xx]` — a detailed assumption introduced while writing this spec to make a rule testable. All are recorded, with status, in [DECISIONS.md §6](../DECISIONS.md#6-detailed-functional-assumptions-new-xx).
- **Priority**
  - **P0** — needed to meet an acceptance criterion or a hard constraint. The PoC fails without it.
  - **P1** — robustness/quality expected of a foundation that will grow (error handling, edge cases). Should ship in the PoC.
  - **P2** — nice to have; may be cut under the time-box.

### 0.2 User roles

| Role | Who | What they do in the PoC |
|---|---|---|
| **Customer** | Anonymous visitor using a web browser [A39]. No account [A38]. | Browses, searches, views products, sends enquiries. |
| **Store Owner** | The entrepreneur. | Decides which 5 products are "top rated" on the home page [A1]. Does not use a UI in the PoC [A2]. |
| **Operator** | Developer / person running the app on the owner's behalf; also the challenge reviewer running it locally. | Edits configuration (featured products, sales inbox, branding), starts the app, checks the local test mailbox [A2, A35]. |
| **Sales Team** | Whoever reads the sales inbox. | Receives enquiry emails and replies to customers [A30]. |

### 0.3 Core data (as seen by users)

**Product** — supplied by the product data source (Fake Store in the PoC), read-only [A42]:

| Field | Used for |
|---|---|
| ID | URLs, featured configuration, enquiry reference |
| Title | Tiles, product page, search, email |
| Price | Tiles, product page, email. Displayed as USD, display only — not a binding quote [A22]. Public vs quote-based pricing is open question Q7 |
| Description | Product page, search |
| Category | Category grouping, product page, search |
| Image | Tiles, product page |
| Rating (average score and number of ratings) | Tiles, product page, category "top rated" ordering [A7] |

**Category** — the distinct category values present on products in the data source [A6]. Fake Store currently has 4: `electronics`, `jewelery`, `men's clothing`, `women's clothing`.

### 0.4 Module overview

| Module | Features |
|---|---|
| 1. Global layout & navigation (GLB) | GLB-01 Header, GLB-02 Product tile, GLB-03 Page states, GLB-04 Addressable pages, GLB-05 Accessibility |
| 2. Home (HOM) | HOM-01 Featured "top rated" products, HOM-02 Browse categories |
| 3. Category browsing (CAT) | CAT-01 Category page, CAT-02 Unknown category |
| 4. Search (SRC) | SRC-01 Search entry & submission, SRC-02 Search matching & results, SRC-03 No results |
| 5. Product details (PRD) | PRD-01 Product details page, PRD-02 Product not found |
| 6. Enquiry (ENQ) | ENQ-01 Open enquiry form, ENQ-02 Form validation, ENQ-03 Submit & notify sales, ENQ-04 Thank-you confirmation, ENQ-05 Submission failure, ENQ-06 Abuse protection |
| 7. Configuration & operations (CFG) | CFG-01 Featured products configuration, CFG-02 Sales inbox & email delivery configuration, CFG-03 Local test mailbox, CFG-04 Branding configuration |

---

## 1. Module: Global layout & navigation (GLB)

### GLB-01 — Site header

**Description:** A header shown on every page, giving access to home, search and categories from anywhere.
**User roles:** Customer
**Priority:** P0
**Preconditions:** None.

**User workflow**
1. Customer opens any page.
2. Header shows the store name/logo, the search bar and links to every category.
3. Customer clicks the store name → home page; clicks a category → that category page; uses the search bar → SRC-01.

**Business rules**
- BR1. The search bar is on every page [A19].
- BR2. Category links are shown on every page, in the header [NEW-01].
- BR3. Category links are built only from categories that exist in the data source [A6, A11].
- BR4. Store name and logo come from branding configuration [A40].

**Functional requirements**
- GLB-01.FR1 Header appears on home, category, search results, product and not-found pages.
- GLB-01.FR2 Store name/logo links to the home page.
- GLB-01.FR3 One link per category, labelled with the category name (first letter capitalised, otherwise as provided by the data source) [NEW-02].
- GLB-01.FR4 Categories are listed in alphabetical order [NEW-03].
**Edge cases**
- Data source returns zero categories → no category links; header still shows name and search.
- Category name containing special characters (e.g. `men's clothing`) → link works and label displays the apostrophe correctly.

**Error scenarios**
- Categories cannot be loaded (data source unavailable) → header still renders with name and search; category links are omitted; the rest of the page follows GLB-03.

**Acceptance criteria**
```
GIVEN I am on any page of the site
WHEN the page has loaded
THEN I see the store name, a search bar and a link to every category

GIVEN I am on a product page
WHEN I click the store name
THEN I am taken to the home page

GIVEN the data source has categories "electronics" and "men's clothing"
WHEN I view the header
THEN I see links labelled "Electronics" and "Men's clothing" in alphabetical order
```

---

### GLB-02 — Product tile

**Description:** The standard compact view of a product used on every listing (home, category, search).
**User roles:** Customer
**Priority:** P0
**Preconditions:** A product is available to display.

**User workflow**
1. Customer sees a tile in a listing.
2. Customer clicks/taps anywhere on the tile → product details page for that product (PRD-01).

**Business rules**
- BR1. Every tile on every listing links to the product page [A20, AC "Product page"].
- BR2. A tile shows image, title, price and rating [A20].
- BR3. Price shown in USD with two decimals, e.g. `$109.95` [A22].
- BR4. Rating shown as average score (one decimal) and number of ratings, e.g. `3.9 (120)` [NEW-04].

**Functional requirements**
- GLB-02.FR1 Tile shows image, title, price, rating.
- GLB-02.FR2 The whole tile is a single link to `/product/{id}` (see GLB-04).
- GLB-02.FR3 Long titles are truncated visually on the tile (full title available to assistive tech and on the product page) [NEW-05].
- GLB-02.FR4 Image alt text is the product title [A44].

**Edge cases**
- Image missing or fails to load → neutral placeholder image shown; tile still clickable [NEW-06].
- Rating missing → rating area omitted; tile still shown [NEW-07].
- Price `0` → shown as `$0.00` (not hidden) [NEW-08].

**Error scenarios**
- None beyond the edge cases; a tile never blocks the rest of the listing.

**Acceptance criteria**
```
GIVEN I am viewing a list of products on the home, category or search page
WHEN I click on a product tile
THEN I see the product details page for that product

GIVEN a product with price 109.95 and rating 3.9 from 120 ratings
WHEN I see its tile
THEN it shows its image, title, "$109.95" and "3.9 (120)"

GIVEN a product whose image cannot be loaded
WHEN I see its tile
THEN a placeholder image is shown and the tile still links to the product page
```

---

### GLB-03 — Page states (loading, empty, error)

**Description:** Consistent behaviour while data loads or when it is unavailable, so the customer never sees a crash or blank screen.
**User roles:** Customer
**Priority:** P1
**Preconditions:** A page needs product or category data.

**User workflow**
1. Customer opens a page.
2. While data loads → a loading indicator is shown.
3. Data arrives → content shown. No data → empty state. Data source failed → error state with a "Try again" action.

**Business rules**
- BR1. Every data-driven page has loading, empty and error states [A43].
- BR2. Error messages are friendly and never show technical details (stack traces, upstream URLs, status codes) [A43].
- BR3. The product data source being unavailable must not crash the site [A43].

**Functional requirements**
- GLB-03.FR1 Loading indicator shown while data is being fetched.
- GLB-03.FR2 Error state shows: a plain-language message (e.g. "We couldn't load products right now."), a **Try again** button that reloads the data, and the header (GLB-01).
- GLB-03.FR3 Empty states are page-specific and defined in HOM-01, CAT-01, SRC-03.
- GLB-03.FR4 If the data source does not respond within a reasonable time, the request is treated as failed and the error state is shown rather than loading forever [NEW-09].

**Edge cases**
- Data source slow but eventually succeeds → loading state, then content; no error flashes.
- Data source returns malformed/partial product records → those records are skipped; valid ones are shown [NEW-10].

**Error scenarios**
- Data source unreachable / times out / returns server error → error state.
- Customer clicks **Try again** while the source is still down → error state shown again, no crash.

**Acceptance criteria**
```
GIVEN the product data source is unavailable
WHEN I open the home page
THEN I see a friendly error message and a "Try again" button
AND I do not see technical error details

GIVEN I am seeing the error state
AND the product data source has recovered
WHEN I click "Try again"
THEN the page content loads normally
```

---

### GLB-04 — Addressable pages

**Description:** Each page has its own URL so it can be bookmarked, shared, reloaded and navigated with the browser's back/forward buttons.
**User roles:** Customer
**Priority:** P1
**Preconditions:** None.

**Business rules**
- BR1. Product pages and search results have their own URLs [A16, A24].
- BR2. Category pages have their own URLs [NEW-11].
- BR3. Unknown URLs show a "page not found" page with links back to browsing [NEW-12].

**Functional requirements**
- GLB-04.FR1 Page addresses:

  | Page | Address pattern | Example |
  |---|---|---|
  | Home | `/` | `/` |
  | Category | `/category/{category id}` (a UUID, T15) | `/category/6f1c2b9e-3d4a-5e8f-9a0b-1c2d3e4f5a6b` |
  | Search results | `/search?q={term}` | `/search?q=backpack` |
  | Product | `/product/{product id}` | `/product/1` |

- GLB-04.FR2 Opening any address directly (new tab, reload, shared link) shows the same content as navigating to it.
- GLB-04.FR3 Browser back/forward moves between previously visited pages correctly.
- GLB-04.FR4 Any other address shows the not-found page (header + "Page not found" + link to home).

**Edge cases**
- Category names with spaces/apostrophes are encoded in the address and decoded correctly.
- Trailing slash (e.g. `/product/1/`) behaves the same as without [NEW-13].

**Error scenarios**
- Unknown category → CAT-02. Unknown product → PRD-02. Unknown path → not-found page.

**Acceptance criteria**
```
GIVEN I am on the product page for product 1
WHEN I copy the address and open it in a new tab
THEN I see the same product page

GIVEN I searched for "backpack"
WHEN I reload the page
THEN I still see the results for "backpack"

GIVEN I open "/does-not-exist"
WHEN the page loads
THEN I see a "Page not found" message and a link to the home page
```

---

### GLB-05 — Accessibility

**Description:** Baseline usability for keyboard and assistive-technology users.
**User roles:** Customer
**Priority:** P1
**Preconditions:** None.

**Business rules**
- BR1. Keyboard navigable, labelled form fields, image alt text, sufficient contrast [A44].
- BR2. Layout across screen sizes (responsiveness) is **not specified** by this document; it belongs to the look-and-feel work [A39, A40].

**Functional requirements**
- GLB-05.FR1 All interactive elements (links, tiles, search, Enquire, form fields, buttons) are reachable and usable with the keyboard alone, with a visible focus indicator.
- GLB-05.FR2 All form fields have visible labels; required fields are indicated in text, not by colour alone.
- GLB-05.FR3 Validation errors and the thank-you message are announced to screen readers [NEW-14].
- GLB-05.FR4 Text/background contrast meets WCAG 2.1 AA [NEW-16].

**Edge cases**
- Very long product titles/descriptions wrap without breaking layout.

**Error scenarios**
- N/A.

**Acceptance criteria**
```
GIVEN I am using only a keyboard
WHEN I navigate from the home page to a product and submit an enquiry
THEN I can complete the whole journey without a mouse
```

---

## 2. Module: Home (HOM)

### HOM-01 — Featured "top rated" products

**Description:** The home page shows the 5 products the Store Owner has chosen as "top rated".
**User roles:** Customer (views), Store Owner (chooses, via CFG-01)
**Priority:** P0
**Preconditions:** Featured product IDs are configured (CFG-01).

**User workflow**
1. Customer opens the home page.
2. A section titled "Top rated" shows the owner's chosen products as tiles (GLB-02), in the configured order.
3. Customer clicks a tile → PRD-01.

**Business rules**
- BR1. Home "top rated" = the owner's chosen products, **not** computed from customer ratings [A1].
- BR2. Exactly the configured products are shown — at most 5 [AC "Home page"].
- BR3. Shown in the configured order [A3].
- BR4. A configured ID that does not match a product (stale ID) is skipped and a warning is logged for the Operator; never replaced with another product [A4, A4a].
- BR5. If no configured product can be shown, the "Top rated" section is hidden; the rest of the home page (HOM-02) still shows [NEW-17].

**Functional requirements**
- HOM-01.FR1 Read the featured list from configuration (CFG-01).
- HOM-01.FR2 Retrieve each configured product from the data source (through the backend, never directly from the browser [AC constraint 2]).
- HOM-01.FR3 Display found products as tiles in configured order under the heading "Top rated".
- HOM-01.FR4 Skip missing products and log a warning naming the missing ID.
- HOM-01.FR5 Display no more than 5 products even if more are configured (see CFG-01).

**Edge cases**
| Configuration | Expected home page |
|---|---|
| 5 valid IDs | 5 tiles, configured order |
| 5 IDs, 1 stale | 4 tiles, warning logged for the stale ID |
| 5 IDs, all stale | "Top rated" section hidden, categories still shown, 5 warnings logged |
| Empty / not configured | "Top rated" section hidden, warning logged at startup (CFG-01) |
| Same ID listed twice | Product shown once, in first position (CFG-01) |
| More than 5 IDs | First 5 used (CFG-01) |

**Error scenarios**
- Data source unavailable → home page error state (GLB-03).
- Data source fails for one product only → that product treated as not available; others shown [NEW-18].

**Acceptance criteria**
```
GIVEN the owner has chosen products 3, 7, 12, 1 and 18 as "top rated" in that order
WHEN I am viewing the home page
THEN I see exactly those 5 products in the "Top rated" section
AND they appear in the order 3, 7, 12, 1, 18

GIVEN the owner has chosen products 3, 7, 12, 1 and 999
AND product 999 does not exist
WHEN I am viewing the home page
THEN I see products 3, 7, 12 and 1 only
AND a warning about product 999 is logged

GIVEN no featured products are configured
WHEN I am viewing the home page
THEN no "Top rated" section is shown
AND I can still see and use the category links and search
```

---

### HOM-02 — Browse categories from home

**Description:** The home page gives the customer a visible way into each category, beyond the header.
**User roles:** Customer
**Priority:** P0
**Preconditions:** Categories are available from the data source.

**User workflow**
1. Customer opens home page.
2. Below the "Top rated" section, a "Shop by category" section lists every category as a link.
3. Customer clicks a category → CAT-01.

**Business rules**
- BR1. Home page is the entry point to every journey: featured products, categories and search [A5].
- BR2. Same category list, labels and ordering as the header (GLB-01 BR3, FR3, FR4).

**Functional requirements**
- HOM-02.FR1 Show a "Shop by category" section with one link per category.
- HOM-02.FR2 Each link goes to `/category/{category id}`.

**Edge cases**
- Zero categories → section hidden.

**Error scenarios**
- Categories cannot be loaded → section hidden; featured section unaffected if it loaded [NEW-18].

**Acceptance criteria**
```
GIVEN my products are organised into categories
WHEN I am viewing the home page
THEN I see a link for each category

GIVEN I am on the home page
WHEN I click the "Electronics" category link
THEN I am taken to the Electronics category page
```

---

## 3. Module: Category browsing (CAT)

### CAT-01 — Category page

**Description:** Shows the top rated products in a category, followed by the other products in that category.
**User roles:** Customer
**Priority:** P0
**Preconditions:** The category exists in the data source.

**User workflow**
1. Customer clicks a category link (header, home page, or product page category link).
2. Category page shows the category name as the heading.
3. "Top rated in {category}" section shows up to 3 tiles.
4. "More in {category}" section shows the remaining products in the category.
5. Customer clicks a tile → PRD-01.

**Business rules**
- BR1. Category "top rated" = highest **customer** rating within the category [A7]. (Differs from home page — see DECISIONS.md open question Q1.)
- BR2. Ordering for top rated: average rating descending; ties broken by number of ratings descending [A7]; remaining ties broken by product ID ascending [NEW-19].
- BR3. Top rated section shows up to **3** products [A8]. The number is configurable [A8].
- BR4. Products without a rating are never in the top rated section; they appear in "More in…" [NEW-07].
- BR5. "More in…" = every other product in the category, never repeating a top-rated product [A9].
- BR6. "More in…" order = data source order [NEW-20].
- BR7. No pagination, sorting or filtering [A10].
- BR8. If the category has 3 or fewer products, all appear in "Top rated" and the "More in…" section is hidden [NEW-21]. (Not reachable with current Fake Store data — smallest category has 4 products.)

**Functional requirements**
- CAT-01.FR1 Heading shows the category name (formatted as GLB-01.FR3).
- CAT-01.FR2 Retrieve all products in the category from the data source via the backend.
- CAT-01.FR3 Split them into "Top rated" (BR2–BR4) and "More in…" (BR5–BR6).
- CAT-01.FR4 Render both sections as tiles (GLB-02).
- CAT-01.FR5 Every product in the category appears exactly once across the two sections.

**Edge cases**
- Category with 4 products (e.g. `jewelery`) → 3 top rated + 1 more.
- Two products with equal average rating → the one with more ratings ranks higher; if equal again, lower ID first.
- All products unrated → top rated section hidden, all products under "More in…" [NEW-07].
- Category exists but currently has 0 products → empty state: "There are no products in this category yet." with link to home [NEW-22].

**Error scenarios**
- Unknown category → CAT-02.
- Data source unavailable → error state (GLB-03).

**Acceptance criteria**
```
GIVEN my products are organised into categories
WHEN I click on the "Electronics" category link
THEN I see a "Top rated in Electronics" section with the 3 highest-rated electronics products
AND I see a "More in Electronics" section with the other electronics products

GIVEN a category contains products A (4.5, 100 ratings), B (4.5, 300 ratings), C (4.0), D (3.0)
WHEN I view that category page
THEN the "Top rated" section shows B, A, C in that order
AND the "More in" section shows D only

GIVEN I am on any category page
WHEN I look at both sections
THEN every product in that category appears exactly once
AND no product from another category appears
```

---

### CAT-02 — Unknown category

**Description:** Friendly handling when a category address does not match any category.
**User roles:** Customer
**Priority:** P1
**Preconditions:** Customer opens a category address that does not exist.

**User workflow**
1. Customer opens a category address whose ID matches no category: an edited/mistyped URL, or an old bookmark after the data source renamed or removed the category (the ID is derived from the name, T15).
2. Page shows "We couldn't find that category." plus links to all existing categories and to home.

**Business rules**
- BR1. Cannot occur through normal clicking; occurs via edited/typed URLs or stale bookmarks/links after data source changes [A11].
- BR2. Show a friendly not-found state with links to real categories — never an error page or an empty product list [A11].
- BR3. Category IDs are UUIDs and are matched exactly; hex letters are compared case-insensitively, as UUIDs are case-insensitive [NEW-23, T15].

**Functional requirements**
- CAT-02.FR1 Detect that the requested category is not among the data source's categories.
- CAT-02.FR2 Show the not-found message, the list of existing categories and a link to home.

**Edge cases**
- Not a UUID at all (e.g. `/category/shoes`) → category not found (not an error page).
- Well-formed UUID that matches no category → category not found.
- Same UUID in upper case → same category page.
- Data source renames a category (e.g. `jewelery` → `jewelry`) → its ID changes; old links show category not found. Accepted (A11).
- Empty category ID (`/category/`) → treated as unknown path (GLB-04.FR4).

**Error scenarios**
- Data source unavailable → error state (GLB-03), **not** "category not found" (we cannot know it doesn't exist).

**Acceptance criteria**
```
GIVEN no category has the ID "00000000-0000-5000-8000-000000000000"
WHEN I open "/category/00000000-0000-5000-8000-000000000000"
THEN I see "We couldn't find that category."
AND I see links to all existing categories

GIVEN I open "/category/shoes"
WHEN the page loads
THEN I see "We couldn't find that category." (not an error page)

GIVEN the product data source is unavailable
WHEN I open the Electronics category page
THEN I see the error state with "Try again"
AND I do not see "We couldn't find that category."
```

---

## 4. Module: Search (SRC)

### SRC-01 — Search entry & submission

**Description:** The customer types a term in the header search bar and submits it.
**User roles:** Customer
**Priority:** P0
**Preconditions:** None (search bar is on every page).

**User workflow**
1. Customer types a term into the search bar.
2. Customer clicks the **Search** button or presses Enter.
3. Customer is taken to `/search?q={term}` (SRC-02).

**Business rules**
- BR1. Search is triggered by the Search button [AC] and by Enter [A15].
- BR2. Leading/trailing whitespace is trimmed [A13].
- BR3. An empty or whitespace-only term is not submitted; a hint "Enter a search term" is shown [A13].
- BR4. Maximum term length is 100 characters; the field does not accept more [NEW-24].
- BR5. On the results page, the search bar is pre-filled with the current term [NEW-25].

**Functional requirements**
- SRC-01.FR1 Search bar has a visible label/placeholder ("Search products") and a Search button.
- SRC-01.FR2 On submit: trim; if empty, show hint and stay on page; else navigate to results.
- SRC-01.FR3 Term is passed exactly as typed (after trimming), including special characters.

**Edge cases**
- Term of only spaces → hint, no navigation.
- Term with special characters (`'`, `&`, `%`, `?`) → submitted and displayed correctly.
- Term with internal multiple spaces → kept as typed (only ends trimmed) [A13].

**Error scenarios**
- Opening `/search` with no `q` or an empty `q` directly → results page shows "Enter a search term" and no products [NEW-26].

**Acceptance criteria**
```
GIVEN I have entered "backpack" in the search bar
WHEN I click the search button
THEN I am taken to the search results for "backpack"

GIVEN I have entered "backpack" in the search bar
WHEN I press Enter
THEN I am taken to the search results for "backpack"

GIVEN the search bar is empty or contains only spaces
WHEN I click the search button
THEN I stay on the current page
AND I see the hint "Enter a search term"
```

---

### SRC-02 — Search matching & results

**Description:** Returns only products whose text matches the search term.
**User roles:** Customer
**Priority:** P0
**Preconditions:** A non-empty search term has been submitted.

**User workflow**
1. Results page shows heading `Results for "{term}"` and a count, e.g. "3 products".
2. Matching products shown as tiles (GLB-02).
3. Customer clicks a tile → PRD-01.

**Business rules**
- BR1. A product matches if the **whole search term** appears, **case-insensitively**, anywhere in its **title, description or category** [A12].
- BR2. Only matching products are shown [AC].
- BR3. Searches the whole catalogue, not the current category [A14].
- BR4. No fuzzy matching, stemming, synonyms or relevance ranking [A12].
- BR5. Results shown in data source order [NEW-20].
- BR6. Matching is performed by the backend, never in the browser against the data source [A18, AC constraint 2].
- BR7. The term is treated as literal text — characters such as `.`, `*`, `?`, `%` have no special meaning [NEW-27].

**Functional requirements**
- SRC-02.FR1 Show heading with the term as typed, and the count of results ("1 product" / "N products").
- SRC-02.FR2 Show every matching product once, as tiles.
- SRC-02.FR3 Term is displayed safely (as text, never interpreted as markup).

**Edge cases** (QA should cover these explicitly)
| Term | Expected | Why |
|---|---|---|
| `BACKPACK` | Same results as `backpack` | Case-insensitive |
| `pack` | Matches "Backpack" | Substring match |
| `men's` | Matches products in **both** `men's clothing` and `women's clothing` | "women's" contains "men's" — expected under BR1, not a bug |
| `jewelry` | Does **not** match `jewelery` products unless the word appears in title/description | No fuzzy matching |
| `slim fit` | Only products containing the exact phrase "slim fit" | Whole term, not separate words |
| `electronics` | All electronics products | Category is searched |
| `.*` | Only products literally containing ".*" (likely none) | Literal match |
| 100-character term | Works, likely 0 results | Max length |

**Error scenarios**
- Data source unavailable → error state (GLB-03), not "no results".

**Acceptance criteria**
```
GIVEN I am looking for a specific product
AND I have entered "backpack" in the search bar
WHEN I click the search button
THEN I only see products whose title, description or category contains "backpack" (any case)
AND I see how many products matched

GIVEN a product's title contains "Backpack" but not "BACKPACK"
WHEN I search for "BACKPACK"
THEN that product is in the results

GIVEN I am on the Jewelery category page
WHEN I search for "cotton"
THEN I see matching products from all categories, not only Jewelery
```

---

### SRC-03 — No results

**Description:** Clear feedback when nothing matches.
**User roles:** Customer
**Priority:** P1
**Preconditions:** A search returned zero products.

**Business rules**
- BR1. Zero results show a clear message and a route back to browsing [A17].

**Functional requirements**
- SRC-03.FR1 Show `No products match "{term}".`
- SRC-03.FR2 Show links to the home page and to every category.
- SRC-03.FR3 Search bar remains pre-filled so the customer can edit the term.

**Edge cases**
- Term containing markup characters (`<b>x</b>`) → displayed literally in the message.

**Error scenarios**
- Data source failure must not be shown as "no results" (see SRC-02).

**Acceptance criteria**
```
GIVEN no product contains the text "zzzz"
WHEN I search for "zzzz"
THEN I see 'No products match "zzzz".'
AND I see links back to the home page and the categories
```

---

## 5. Module: Product details (PRD)

### PRD-01 — Product details page

**Description:** Full details of one product, and the starting point for an enquiry.
**User roles:** Customer
**Priority:** P0
**Preconditions:** Product exists in the data source.

**User workflow**
1. Customer clicks a product tile (or opens a product link).
2. Page shows image, title, price, category, rating, description and an **Enquire** button.
3. Customer may click the category → CAT-01, or **Enquire** → ENQ-01.

**Business rules**
- BR1. Clicking a tile shows the product details page [AC].
- BR2. Shows image, title, price, category (linked), description, rating (average + count) and Enquire [A21].
- BR3. Price as USD, display only — not a binding quote, no purchase, and not required to enquire [A22, A38].

**Functional requirements**
- PRD-01.FR1 Retrieve the product by ID via the backend.
- PRD-01.FR2 Display all fields in BR2; full description (no truncation).
- PRD-01.FR3 Category is a link to `/category/{category id}`.
- PRD-01.FR4 Show an **Enquire** button, visible without scrolling [NEW-28].
- PRD-01.FR5 Page title (browser tab) includes the product title [NEW-29].

**Edge cases**
- Missing image / rating → as GLB-02 edge cases.
- Very long description → wraps, no layout break.

**Error scenarios**
- Product not found / stale ID → PRD-02.
- Data source unavailable → error state (GLB-03).

**Acceptance criteria**
```
GIVEN I am browsing the products
AND I want to see more details about a specific product
WHEN I click on a product tile
THEN I see the product details page
AND it shows the product's image, title, price, category, rating and full description
AND I see an "Enquire" button

GIVEN I am on a product details page
WHEN I click the product's category
THEN I am taken to that category page
```

---

### PRD-02 — Product not found

**Description:** Friendly handling of a product address that does not match any product (e.g. stale bookmark).
**User roles:** Customer
**Priority:** P1
**Preconditions:** Product ID in the address does not exist.

**Business rules**
- BR1. Unknown or stale product ID shows "product not found" with a route back to browsing [A23, A4a].

**Functional requirements**
- PRD-02.FR1 Show "We couldn't find that product. It may no longer be available."
- PRD-02.FR2 Show links to home and categories. No Enquire button.

**Edge cases**
- Non-numeric ID with Fake Store (`/product/abc`) → product not found (not a crash). IDs are treated as opaque text so a future data source with IDs like `SKU-1042` works [A4a].
- Negative / very large ID → product not found.

**Error scenarios**
- Data source unavailable → error state, **not** "product not found".

**Acceptance criteria**
```
GIVEN product 999 does not exist
WHEN I open "/product/999"
THEN I see "We couldn't find that product."
AND I see links back to browsing
AND I do not see an "Enquire" button

GIVEN I open "/product/abc"
WHEN the page loads
THEN I see the product-not-found message, not an error page
```

---

## 6. Module: Enquiry (ENQ)

> Enquiry handling follows **validate → record → notify** [A34]. In the PoC "record" does nothing; storage is Next step #1 in DECISIONS.md.

### ENQ-01 — Open enquiry form

**Description:** From a product page, the customer opens a form to enquire about that product.
**User roles:** Customer
**Priority:** P0
**Preconditions:** Customer is on a valid product page (PRD-01).

**User workflow**
1. Customer clicks **Enquire**.
2. An enquiry form opens on the product page (inline panel or dialog), titled `Enquire about {product title}`.
3. Customer fills in the form (ENQ-02) and clicks **Send enquiry**, or clicks **Cancel** to close it.

**Business rules**
- BR1. One enquiry is about exactly one product — the one being viewed [A25].
- BR2. The form opens on the product page; the product stays identifiable [A26].
- BR3. Product details are attached by the system, not typed by the customer [A28].
- BR4. Closing the form keeps any typed input while the customer stays on that product page; it is lost on navigation or reload [NEW-30].

**Functional requirements**
- ENQ-01.FR1 Enquire button opens the form; focus moves to the first field [A44].
- ENQ-01.FR2 Form shows the product title as context (read-only).
- ENQ-01.FR3 Cancel (and Escape key if shown as a dialog) closes the form.

**Edge cases**
- Clicking Enquire twice → form opens once.

**Error scenarios**
- None at this step.

**Acceptance criteria**
```
GIVEN I am viewing a product
AND I am interested in the product
WHEN I click on the Enquire button
THEN I see an enquiry form titled "Enquire about <product title>"
AND I can still tell which product I am enquiring about
```

---

### ENQ-02 — Form fields & validation

**Description:** Collect the customer's contact details with clear validation.
**User roles:** Customer
**Priority:** P0
**Preconditions:** Enquiry form is open.

**Business rules**
- BR1. Fields [A27]:

  | Field | Required | Rules |
  |---|---|---|
  | Name | Yes | 1–100 characters after trimming [NEW-31]; no line breaks [NEW-32] |
  | Email | Yes | Valid email format (e.g. `name@example.com`); max 254 characters [NEW-31]; no line breaks [NEW-32]. Format check only, no deliverability check [NEW-33] |
  | Phone | No | If given: 7–20 characters; only digits, spaces, `+`, `-`, `(`, `)` [NEW-31] |
  | Message | No | Max 1000 characters [NEW-31]; line breaks allowed |

- BR2. Validation runs in the browser for fast feedback **and** on the server, which is authoritative [A29].
- BR3. On errors, each invalid field shows its own message; all entered input is kept [A29].
- BR4. Leading/trailing whitespace is trimmed before validation [NEW-34].

**Functional requirements**
- ENQ-02.FR1 Required fields are marked "(required)".
- ENQ-02.FR2 Validation messages:

  | Case | Message |
  |---|---|
  | Name empty | "Please enter your name." |
  | Name too long | "Name must be 100 characters or fewer." |
  | Email empty | "Please enter your email address." |
  | Email invalid | "Please enter a valid email address, like name@example.com." |
  | Phone invalid | "Please enter a valid phone number." |
  | Message too long | "Message must be 1000 characters or fewer." |

- ENQ-02.FR3 Browser validation runs on submit and when leaving a field after editing it [NEW-35].
- ENQ-02.FR4 Character counter shown for Message.
- ENQ-02.FR5 Server rejects the same invalid input even if browser validation is bypassed, and returns field-level messages displayed the same way.

**Edge cases**
- Name `"   "` → treated as empty.
- Email with uppercase (`Jane@Example.COM`) → accepted.
- Name with accents/apostrophes (`Zoë O'Brien`) → accepted.
- Message containing HTML/script → accepted as plain text, never rendered as markup (in the browser or the email).
- Name/email containing a line break (pasted or forced via a crafted request) → rejected (protects against email header injection).

**Error scenarios**
- Browser validation bypassed (direct request) → server returns validation errors, no email sent.

**Acceptance criteria**
```
GIVEN the enquiry form is open
AND I leave Name empty and enter "not-an-email" as Email
WHEN I submit the form
THEN no email is sent
AND I see "Please enter your name." next to Name
AND I see "Please enter a valid email address, like name@example.com." next to Email
AND my other input is still in the form

GIVEN I enter a valid name and email and leave Phone and Message empty
WHEN I submit the form
THEN the form is accepted

GIVEN a request is sent directly to the server with an invalid email
WHEN the server processes it
THEN it is rejected with a validation error and no email is sent
```

---

### ENQ-03 — Submit enquiry & notify sales

**Description:** A valid enquiry results in an email to the sales inbox.
**User roles:** Customer (submits), Sales Team (receives)
**Priority:** P0
**Preconditions:** Form passes validation; sales inbox is configured (CFG-02).

**User workflow**
1. Customer clicks **Send enquiry**.
2. Button changes to "Sending…" and is disabled.
3. System validates (ENQ-02), looks up the product, and sends the email.
4. On success → ENQ-04. On failure → ENQ-05.

**Business rules**
- BR1. Sales inbox receives an email for each successful enquiry [AC].
- BR2. Email goes to the single configured sales inbox address [A30].
- BR3. Reply-To is the customer's email, so Sales can reply directly [A30].
- BR4. Product details in the email come from the data source, looked up by the system using the product ID — product title/price sent from the browser are ignored [A28].
- BR5. If the product no longer exists at submit time, the enquiry is rejected [NEW-36].
- BR6. No confirmation email to the customer [A33].
- BR7. Enquiry is not stored [A34].
- BR8. Customer personal data is used only to send the email and is not written to logs in full [A37]. Logs may record that an enquiry was sent, for which product, and the outcome.

**Functional requirements**
- ENQ-03.FR1 Email content [NEW-37]:
  - **To:** configured sales inbox
  - **From:** configured sender address (CFG-02)
  - **Reply-To:** customer email
  - **Subject:** `New enquiry: {product title} (ID {product id})`
  - **Body (plain text):** customer name, email, phone (or "Not provided"), message (or "No message"), product title, product ID, price (the catalogue price at the time of submission, looked up per BR4, so Sales knows the price the customer was shown [A22]), link to the product page, date/time submitted (UTC)
- ENQ-03.FR2 Customer-entered text is included as plain text only.
- ENQ-03.FR3 The send button is disabled while sending to prevent duplicate submissions [NEW-38].

**Edge cases**
- Double-click on Send → only one email.
- Product removed between page load and submit → "Sorry, this product is no longer available." No email sent [NEW-36].
- Customer submits two separate enquiries for the same product (after reload) → two emails; no de-duplication [NEW-39].

**Error scenarios**
- Validation failure → ENQ-02.
- Email provider unavailable / rejects → ENQ-05.
- Data source unavailable during product lookup → ENQ-05 (generic failure; enquiry not sent).
- Rate limit exceeded → ENQ-06.

**Acceptance criteria**
```
GIVEN I am viewing product 1
AND I click on the Enquire button
AND I complete the form with name "Jane Doe" and email "jane@example.com"
WHEN I submit the form
THEN the sales inbox receives one email with subject "New enquiry: <product 1 title> (ID 1)"
AND the email contains my name, email, the product title, ID, price and a link to the product
AND replying to the email addresses "jane@example.com"

GIVEN I submit an enquiry with a modified request claiming the product title is "FREE ITEM"
WHEN the sales inbox receives the email
THEN the email shows the real product title from the catalogue

GIVEN I click "Send enquiry" twice quickly
WHEN the submission completes
THEN the sales inbox receives exactly one email
```

---

### ENQ-04 — Thank-you confirmation

**Description:** The customer sees confirmation once the enquiry has been sent.
**User roles:** Customer
**Priority:** P0
**Preconditions:** ENQ-03 succeeded (email accepted for sending).

**Business rules**
- BR1. Customer sees a "Thank you" message [AC].
- BR2. Shown **only after** the email has been accepted for sending — never optimistically [A31].
- BR3. The message replaces the form on the same page and names the product [A32].

**Functional requirements**
- ENQ-04.FR1 Message text [NEW-40]: "Thank you, {name}. We've received your enquiry about {product title} and will reply to {email}."
- ENQ-04.FR2 Message is announced to screen readers (GLB-05.FR3).
- ENQ-04.FR3 The Enquire button is not shown again until the page is reloaded/revisited [NEW-41].

**Edge cases**
- Customer reloads after thank-you → normal product page with Enquire button; no resubmission.

**Error scenarios**
- N/A (failures go to ENQ-05 and never show thank-you).

**Acceptance criteria**
```
GIVEN I have completed the enquiry form with valid details
WHEN I submit the form
AND the email is accepted for sending
THEN the form is replaced by a message starting "Thank you"
AND the message names the product I enquired about

GIVEN the email could not be sent
WHEN I submit the form
THEN I do not see a "Thank you" message
```

---

### ENQ-05 — Submission failure

**Description:** Behaviour when the enquiry cannot be sent, so no lead is silently lost.
**User roles:** Customer, Operator
**Priority:** P0
**Preconditions:** Valid enquiry submitted; sending failed.

**Business rules**
- BR1. If sending fails, show an error, keep input, allow retry [A31].
- BR2. Error message is friendly and non-technical [A43].
- BR3. Failure is logged for the Operator without the customer's full personal data [A37].

**Functional requirements**
- ENQ-05.FR1 Show above the form: "Sorry, we couldn't send your enquiry. Please try again in a moment."
- ENQ-05.FR2 All input kept; Send button re-enabled.
- ENQ-05.FR3 No thank-you message; no partial success indicated.

**Edge cases**
- Retry succeeds → ENQ-04; exactly one email received.
- Network drops in the browser before a response → same error; customer may retry. (A duplicate email is possible if the first attempt actually succeeded — accepted for PoC [NEW-42]; resolved by Next step #1.)

**Error scenarios**
- Email provider down, misconfigured or rejecting; data source down during product lookup; request timeout.

**Acceptance criteria**
```
GIVEN the email service is unavailable
AND I have completed the enquiry form
WHEN I submit the form
THEN I see "Sorry, we couldn't send your enquiry. Please try again in a moment."
AND my input is still in the form
AND I do not see "Thank you"

GIVEN my previous submission failed
AND the email service has recovered
WHEN I submit the form again
THEN the sales inbox receives the email
AND I see the "Thank you" message
```

---

### ENQ-06 — Abuse protection

**Description:** Basic protection for a public form that sends email.
**User roles:** Customer (affected), Operator
**Priority:** P1
**Preconditions:** None.

**Business rules**
- BR1. Input length limits (ENQ-02) [A36].
- BR2. Enquiry submissions are rate-limited [A36]: max **5 submissions per 15 minutes per client** (approximated by network address) [NEW-43]. Limit values are configurable.
- BR3. No CAPTCHA [A36].
- BR4. Every submission attempt that reaches the server counts towards the limit, including invalid ones, to also limit probing [NEW-44].

**Functional requirements**
- ENQ-06.FR1 When over the limit: no email sent; show "You've sent several enquiries recently. Please try again later."; keep input.
- ENQ-06.FR2 Rate-limit events are logged (without personal data).

**Edge cases**
- Several customers behind one shared network address may share a limit — accepted for PoC [NEW-43].

**Error scenarios**
- N/A beyond FR1.

**Acceptance criteria**
```
GIVEN I have submitted 5 enquiries in the last 15 minutes
WHEN I submit a 6th enquiry
THEN no email is sent
AND I see "You've sent several enquiries recently. Please try again later."
AND my input is kept
```

---

## 7. Module: Configuration & operations (CFG)

### CFG-01 — Featured products configuration

**Description:** How the Store Owner's "top rated" choice is set in the PoC.
**User roles:** Operator (on behalf of Store Owner)
**Priority:** P0
**Preconditions:** Access to the app's configuration (e.g. environment file based on `.env.example`).

**User workflow**
1. Owner tells the Operator which 5 products to feature, in order.
2. Operator sets the ordered list of product IDs in configuration, e.g. `FEATURED_PRODUCT_IDS=3,7,12,1,18`.
3. Operator restarts/redeploys the app.
4. Home page shows the new selection (HOM-01).

**Business rules**
- BR1. Configuration, not an admin UI [A2].
- BR2. Order in configuration = display order [A3].
- BR3. IDs are opaque text (whatever the data source uses) [A4a].
- BR4. Surrounding whitespace around IDs is ignored; empty entries are ignored [NEW-45].
- BR5. Duplicate IDs: first occurrence kept, later ones ignored, warning logged [NEW-46].
- BR6. More than 5 IDs: first 5 (after de-duplication) used, warning logged [NEW-46].
- BR7. Missing/empty configuration: app still starts; featured section hidden; warning logged [NEW-17].
- BR8. Stale IDs: see HOM-01 BR4 [A4].
- BR9. A committed example configuration lists 5 valid Fake Store IDs so the reviewer sees a populated home page out of the box [NEW-47].

**Functional requirements**
- CFG-01.FR1 Read and normalise the list per BR3–BR6 at startup.
- CFG-01.FR2 Log warnings that name the problem (e.g. "Featured product ID '999' not found in catalogue — skipped").

**Edge cases**
- `3, 7 ,,12` → `[3, 7, 12]`.
- `3,3,7` → `[3, 7]` + duplicate warning.

**Error scenarios**
- See BR5–BR7; configuration problems never stop the site from serving pages.

**Acceptance criteria**
```
GIVEN FEATURED_PRODUCT_IDS is "3, 7 ,,12,3"
WHEN the app starts and I view the home page
THEN I see products 3, 7 and 12 in that order
AND a duplicate-ID warning is logged

GIVEN FEATURED_PRODUCT_IDS is not set
WHEN the app starts
THEN the app runs
AND the home page has no "Top rated" section
AND a warning is logged
```

---

### CFG-02 — Sales inbox & email delivery configuration

**Description:** Where enquiry emails go and how they are sent.
**User roles:** Operator
**Priority:** P0
**Preconditions:** Access to configuration.

**Business rules**
- BR1. Sales inbox address is configuration [A30].
- BR2. Email provider is configuration; changing provider requires no change to the enquiry feature [A35, DECISIONS §6].
- BR3. Sender ("From") address is configuration [NEW-37].
- BR4. Secrets (e.g. provider credentials) are never committed; an example configuration file documents every setting [AC constraint 5].
- BR5. If the sales inbox or sender address is missing or not a valid email, the app **refuses to start** with a clear message [NEW-48]. (Unlike featured products, silently accepting enquiries that cannot be delivered would lose leads.)
- BR6. Defaults in the example configuration point to the local test mailbox (CFG-03) so no account is needed [A35, AC constraint 6].

**Functional requirements**
- CFG-02.FR1 Settings: sales inbox address, sender address, email delivery settings.
- CFG-02.FR2 Startup validation per BR5.

**Edge cases**
- Sales inbox set to a malformed value (`sales@`) → startup fails with "SALES_INBOX is not a valid email address".

**Error scenarios**
- Email delivery settings valid but provider unreachable at runtime → app runs; enquiries fail per ENQ-05.

**Acceptance criteria**
```
GIVEN the sales inbox address is not configured
WHEN the Operator starts the app
THEN the app does not start
AND a message explains which setting is missing

GIVEN the sales inbox is configured as "sales@example.com"
WHEN a customer submits a valid enquiry
THEN the email is addressed to "sales@example.com"
```

---

### CFG-03 — Local test mailbox

**Description:** Lets the reviewer verify the enquiry email locally with no accounts or paid services.
**User roles:** Operator / Reviewer
**Priority:** P0
**Preconditions:** App running locally with default example configuration.

**User workflow**
1. Reviewer starts the app following the README.
2. Reviewer submits an enquiry.
3. Reviewer opens the local test mailbox in a browser and sees the email.

**Business rules**
- BR1. Locally, emails are captured by a local test mailbox viewable in a browser [A35].
- BR2. Starts together with the app; no separate account or sign-up [AC constraints 4, 6].
- BR3. The README states the mailbox address to open [NEW-49].

**Functional requirements**
- CFG-03.FR1 Default configuration delivers all enquiry emails to the local test mailbox.
- CFG-03.FR2 Captured emails show To, From, Reply-To, Subject and body.

**Edge cases**
- None.

**Error scenarios**
- Test mailbox not running → enquiries fail per ENQ-05 (proves failure handling).

**Acceptance criteria**
```
GIVEN I have started the app locally with the default configuration
WHEN I submit a valid enquiry
AND I open the local test mailbox in my browser
THEN I see the enquiry email addressed to the configured sales inbox
```

---

### CFG-04 — Branding configuration

**Description:** Placeholder look and feel that can be replaced in one place when the creative work arrives.
**User roles:** Operator
**Priority:** P2
**Preconditions:** None.

**Business rules**
- BR1. Look and feel is a neutral placeholder [A40].
- BR2. Store name, logo, colours and fonts are defined in one place; changing them requires no change to pages or features [A40].

**Functional requirements**
- CFG-04.FR1 Store name shown in header and browser tab comes from one setting.
- CFG-04.FR2 Colours and fonts defined centrally.

**Edge cases**
- No logo provided → store name shown as text.

**Error scenarios**
- N/A.

**Acceptance criteria**
```
GIVEN the store name setting is changed from "Catalogue" to "Acme"
WHEN the app is restarted
THEN "Acme" appears in the header and browser tab on every page
```

---

## 8. Traceability — challenge acceptance criteria → features

| Challenge acceptance criterion | Covered by |
|---|---|
| Home page — 5 chosen "top rated" products | HOM-01, CFG-01, GLB-02 |
| Category page — category link, top rated + additional | GLB-01, HOM-02, CAT-01, CAT-02 |
| Search — search bar + button, only matching products | GLB-01, SRC-01, SRC-02, SRC-03 |
| Product page — click tile → details | GLB-02, PRD-01, PRD-02 |
| Enquiry — Enquire → form → email to sales + Thank you | ENQ-01 – ENQ-06, CFG-02, CFG-03 |
| Constraint 2 — no direct client → Fake Store calls | HOM-01.FR2, CAT-01.FR2, SRC-02 BR6, PRD-01.FR1 |
| Constraint 5 — no committed secrets | CFG-02 BR4 |
| Constraint 6 — no paid services/accounts | CFG-02 BR6, CFG-03 |

### Priority summary

| P0 | P1 | P2 |
|---|---|---|
| GLB-01, GLB-02, HOM-01, HOM-02, CAT-01, SRC-01, SRC-02, PRD-01, ENQ-01, ENQ-02, ENQ-03, ENQ-04, ENQ-05, CFG-01, CFG-02, CFG-03 | GLB-03, GLB-04, GLB-05, CAT-02, SRC-03, PRD-02, ENQ-06 | CFG-04 |

---

## 9. Assumptions introduced by this spec

The NEW-01 – NEW-49 assumptions referenced throughout this document now live in **[DECISIONS.md §6](../DECISIONS.md#6-detailed-functional-assumptions-new-xx)**, the single source of truth, with their status (accepted / under review / withdrawn).

---

## 10. Out of scope (from DECISIONS.md)

Customer accounts, cart, checkout and payments [A38]; owner admin UI [A2]; enquiry storage and customer confirmation email [A33, A34]; pagination, sorting, filtering [A10, A41]; fuzzy/ranked search [A12]; native mobile apps and responsive/multi-device layout [A39]; multiple currencies/languages/regions [A45]; analytics, SEO, cookie banner [A46]; CAPTCHA [A36].
