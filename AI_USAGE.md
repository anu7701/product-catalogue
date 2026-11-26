# AI Usage

## Tools and models

- **Claude Code** (VS Code extension) with **Claude Opus 5.5**, for everything: reading the brief, writing the planning documents, code, tests, Docker and CI files, and running git/GitHub commands (`gh`).
- Supporting tools the agent drove: npm, Vitest, Playwright, Docker (Colima), GitHub Actions.

## Agent instruction file

[CLAUDE.md](CLAUDE.md) is committed at the repo root. It points the agent at the spec documents, lists the non-negotiable architecture rules (business rules only in services, external systems only through ports, the browser never calls Fake Store, validation in the shared package, opaque IDs, no caching, no personal data in logs…), the testing conventions (tests in `test/` mirroring `src/`, named after spec IDs, no live network calls) and the working style (one plan task per commit, stop and ask when the spec is silent). It was created in P0 and updated when I changed a convention (test folder layout).

## Plan and spec

I worked spec-first, in this order, reviewing each document before moving on. All are in [spec/](spec/) except DECISIONS.md:

1. **[DECISIONS.md](DECISIONS.md)**: requirements and assumptions only, no technology ("make the assumption that fits best").
2. **[FUNCTIONAL_SPEC.md](spec/FUNCTIONAL_SPEC.md)**: every feature with business rules, edge cases and Given/When/Then criteria; every invented rule tagged as an assumption.
3. **[ARCHITECTURE.md](spec/ARCHITECTURE.md)**: stack, boundaries, API, validation, errors, security, testing, deployment, with trade-offs.
4. **[SPEC_REVIEW.md](spec/SPEC_REVIEW.md)**: the AI reviewing all three documents as a senior architect, producing 25 prioritised issues. I chose which to act on.
5. **[IMPLEMENTATION_PLAN.md](spec/IMPLEMENTATION_PLAN.md)**: phases P0–P7 split into small tasks, each with tests and a definition of done.

Then the build went **one phase per pull request** (PRs #1–#9). For each phase I gave the same implementation prompt (below) and read the agent's report: files changed, tests run, deviations from the spec, remaining issues. I merged each PR before the next phase started. [spec/ACCEPTANCE_RESULTS.md](spec/ACCEPTANCE_RESULTS.md) records the final acceptance run.

## Key prompts and moments

1. **"Try to understand the requirements and make the assumption that fits best. Let's not talk about tech implementation now."** Separating *what* from *how* produced a reviewable list of assumptions (A1–A46) before any design. Several follow-up questions of mine became decisions: how the owner configures the 5 featured products, what a "stale ID" is, whether enquiries should be stored (no: A34), whether to show prices at all (yes, display only: A22).

2. **"Review all the project specifications as a senior software architect… do not rewrite the specifications yet."** Asking for a critique before any code found real defects in the AI's own documents: a route collision (`/products/search` vs `/products/{id}` with opaque IDs), a cache design that contradicted the functional spec, an `X-Forwarded-For` setting that let anyone bypass the rate limit, a tie-break rule that only works for numeric IDs. I then decided what to fix and what to defer: *"do not add caching yet, add a second product source, fix the route collision, do not fix R-04 yet."*

3. **"Why are we building validations separately? Validations should be added while adding UI components or APIs."** The plan had a standalone validation phase. I pushed back, and the plan changed to "each schema is written by the task that first needs it, then reused", which kept every rule tested where it's used.

4. **"Slug does not feel right, can we use id?" → "id should be UUID".** This led to deterministic UUID v5 category IDs. The AI pointed out that a random UUID would change on every restart and break every category link, so it used a name-based UUID in a fixed namespace, tested against the RFC test vector (T15).

5. **The per-phase implementation prompt:** *"Before implementation: read the relevant specs, review the repository, identify patterns and dependencies. During: follow the architecture and API contract, don't modify unrelated code, add tests, don't introduce undocumented requirements. After: report files changed, tests executed, deviations, remaining issues."* The fixed report format made every deviation visible and easy to accept or reject.

## Where the AI got something wrong, and how it was caught

**Caught by me (reviewing plans, docs and running the app):**
- **Validation as its own phase** before anything used it (prompt 3 above).
- **Tests inside `src/`.** I asked for a `test/` folder mirroring `src/`; the agent moved every test and added the rule to CLAUDE.md so it stuck.
- **API reachable from my whole network.** Running `npm run dev` showed `Server listening at http://192.168.x.x:3000`, because the default host was `0.0.0.0`. I said it should only be reachable locally; the default became `127.0.0.1` (Docker sets `0.0.0.0` only inside its container, with the port unpublished).
- **Responsiveness in the functional spec** after we'd decided layout belongs to the creative work; removed.
- **"Slug"** as the category identifier (prompt 4).

**Caught by the AI's own review, tests and tooling, which I asked for and checked:**
- The architect review (prompt 2) found the route collision, the cache contradiction and the rate-limit bypass in the AI's earlier documents.
- An edit made the sales email's price "as shown to the customer", contradicting the rule that product details are looked up on the server; noticed and corrected the same turn.
- A formatting check piped through `tail` hid a failure and a commit went in unformatted; the agent amended it and stopped piping check commands.
- The first Nginx config resolved the API's address once at startup (would break if the API restarted) and served `index.html` with a 200 for missing JavaScript files; both found by smoke-testing the container and fixed.
- A test named "1000 characters" actually tested 998 (trimming removed the line breaks); a few tests relied on fixed timings and could have been flaky. Both fixed.
- To check the tests themselves, the agent **deliberately broke the enquiry form** (removed the double-submit guard; showed "Thank you" before the API answered) and confirmed the right tests failed, then restored it.
- Library versions newer than its training (React Router 8, MSW 3, Vitest 5) were checked by inspecting the installed packages rather than assumed; one renamed MSW option was caught by the type checker.

## How I reviewed the output

- Read each planning document and the review before approving the next step.
- Read each phase report and its deviations, and merged each phase PR myself.
- Ran the app locally during development.
- CI (lint, typecheck, unit/component tests, Docker build and Playwright acceptance tests) runs on every push.
