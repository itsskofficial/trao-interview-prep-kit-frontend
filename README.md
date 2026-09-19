# AI Interview Prep Kit - frontend

[![CI](https://github.com/itsskofficial/trao-interview-prep-kit-frontend/actions/workflows/ci.yml/badge.svg)](https://github.com/itsskofficial/trao-interview-prep-kit-frontend/actions/workflows/ci.yml)

The interface for the AI Interview Prep Kit: paste a job description, name the company's website, say how many days you have, watch the kit being researched and generated, reshape it, and practise against it.

- **Live app:** https://trao-interview-prep-kit.vercel.app
- **Backend, pipeline and batch command:** [trao-interview-prep-kit-backend](https://github.com/itsskofficial/trao-interview-prep-kit-backend). Its README covers the architecture, retrieval, sequencing, scheduling and the state model in full; this one covers the interface.

**Stack:** Next.js 16 (App Router), Tailwind CSS 4, TypeScript, SWR for reads, dnd-kit for reordering, Playwright for browser tests. The preferred stack, unchanged.

## Run it

Requires Node.js 20.18.1 or newer (22 recommended).

```bash
npm install
cp .env.example .env.local    # BACKEND_URL, default http://localhost:4000
npm run dev
```

The easiest backend to run beside it needs no key and no database: in the backend repository, `npm install && npm run dev:offline` (in-memory MongoDB, a mechanical stand-in for the model, fixture company sites on port 8099). Then create a kit with company website `http://localhost:8099/acme/`.

| Variable | What it is for |
|----------|----------------|
| `BACKEND_URL` | Where the API lives. The app rewrites `/api/*` to it, so the browser only ever talks to this origin. It is not a secret. |

**Deployed** on Vercel with `BACKEND_URL` set to the Render URL of the backend.

```bash
npm run lint
npm run typecheck
npm run build
npm run e2e                   # browser tests; starts the backend's offline mode itself (expects ../backend)
```

## How it is put together

```
src/
  proxy.ts                    first gate on protected routes (Next 16's name for middleware)
  app/(auth)/                 sign in, create account
  app/(app)/                  the signed-in shell: kit list, new kit, job progress, kit
  app/(print)/                the one-page summary, outside the shell
  lib/
    api.ts                    one fetch wrapper: ApiError with per-field issues, 401 handling, slow-server notice
    types.ts                  the kit and API types; isProtected, the same rule the backend applies
    kit-ops.ts                every change to a kit as data: how it applies locally, which request it becomes
    save-queue.ts             a plain class that sends those changes in order (no React)
    kit-editor.ts             the hook that joins the two: the kit as the user sees it
    hooks.ts                  lists and job polling
  components/
    ui/primitives.tsx         Button, Field, Alert, Card, Badge, EmptyState, Skeleton, Spinner
    jobs/                     new-kit form, batch upload, live progress
    kits/                     kit page and its tabs, question list, regenerate dialog, practice, schedule, print
e2e/                          Playwright specs and helpers
```

State boundaries are deliberate. **Server state** (lists, jobs, practice progress) is read with SWR and polled only while something is running. **The kit being edited** is the one piece of client state with real rules, and it lives in `lib/`, not in components: components call `actions.editQuestion(...)` and render what they are given.

## Interaction design

The brief asks how four situations are handled. Each has one answer in the code.

### A long-running generation

Starting a kit returns at once and lands on a progress page that polls the job every two seconds: an overall bar, then each pipeline step in words a candidate would use, with what it found ("6 pages read, hiring page found"). Steps are announced through a polite live region. The job lives on the server, so the page can be closed and reopened, from any device; the kit list shows work in progress first. When the free-tier backend is waking up, any request slower than four seconds raises a "waking the server" notice rather than looking broken.

### A partial failure

A site that cannot be read, a missing hiring page, or a search that finds nothing is shown on the step as an amber warning with the reason and "the kit carries on without this and says so". The kit then opens with a **"What this kit could not find"** panel at the top, and a research log listing every source tried and what came of it. Only a failure with no kit at all (the model down on every provider) is an error, and it comes with a retry.

### An edit in flight

Text is edited in place: no edit mode, no save button. Every change applies to the local kit immediately and is queued; the queue sends **one small request per change**, never the whole kit, in order. A burst of typing on one item merges into one request after a 700 ms pause. A **saved / saving / not saved** indicator is always visible while editing. A request that fails stays in the queue with a Retry; nothing is dropped silently. One the server refuses outright (the item was deleted elsewhere) is dropped, explained, and the kit refreshed. What is shown is derived, not copied: the server's kit from the shared cache, unless the user has changes the server has not confirmed, in which case their local version. The local version is dropped **only when the queue runs dry**, so an answer that arrives late can never overwrite newer typing, and the two can never drift. Text is saved exactly as typed (the server does not trim it, or the space before your next word would vanish when the save landed). Clearing a required field marks it invalid and is not sent until something is typed. Only the newest waiting change can absorb a merge, so a reorder never jumps ahead of the move that came before it. Leaving the page sends whatever was still waiting, and closing the tab with unsaved work asks first.

### A regeneration that must not clobber someone's work

Every item shows what a regeneration would do to it: **Generated**, **Edited**, **Pinned**, **Yours**, or **Written by the app** (a question code wrote to guarantee a must-have is covered). The Regenerate dialog says how many items will be replaced and how many will be kept, and its default button is Cancel. While it runs the section is marked as regenerating and only the replaceable items are dimmed, each saying "Edit or pin it to keep it", which is true: the backend merges into the kit as it is when the model answers, so touching an item mid-regeneration protects it. Afterwards a banner offers **Undo**. A brief the user edited is not replaced without an explicit confirmation. If regeneration fails, the banner says nothing was changed.

### Also

- **Reordering** works by mouse, touch and keyboard (focus the handle, Space, arrows, Space; each step is announced), with up and down buttons as a second path. Moving between categories is a select on the question.
- **Deleting** is instant, with a six-second Undo. Undo works by not having told the server yet. Focus moves to the Undo button (the deleted button had it) and the countdown waits while it stays there. Anything that depends on the list settles the delete first: a reorder, a move, an add, a regeneration, switching tab, closing the page.
- **Practice** runs entirely from the keyboard: Space reveals, 1 to 4 rates confidence. Progress shows covered, not covered and mastered, and a bar of cards per box.
- **The schedule** groups long plans by week, first week open, so sixty days stay navigable on a phone. The weak-spots panel re-plans the remaining days around what practice shows you are unsure of.
- **The coverage map** on the Overview tab sets every requirement against the questions and flashcards that cover it, must-haves first; an uncovered one is unmistakable, and each question chip links to that question. **Download JSON** saves the kit in exactly the Appendix A structure. A kit can be **deleted** from the list or its page, after a confirmation that names it. Unknown routes and unexpected errors get pages in the app's own style with a way back.
- **The one-page summary** is a print layout for A4 of the kit as the user has shaped it: brief, published interview process, must-haves, the top questions per category, the plan.
- **Accessibility:** a skip link; labelled fields with errors tied to the control and announced; native `dialog` for modals (focus trapped, Escape closes, focus returns); tabs follow the ARIA tabs pattern with arrow keys and live in the URL; visible focus on everything; motion removed under `prefers-reduced-motion`. Usable from a 360 px phone up.
- **Sessions:** the API's cookie is first-party because `/api/*` is rewritten to the backend. `proxy.ts` gates protected routes on the cookie's presence and remembers where the user was going; the API is the authority, so any 401 sends the user to sign in, says when the session expired, and returns them afterwards. The return path is resolved the way the browser will resolve it and accepted only if it stays on this origin (a prefix check is not enough: browsers read `/\evil.com` as `//evil.com`). A session the server has stopped accepting is ended before going to sign in, so the guard cannot loop.

## Tests

Twenty-two Playwright tests drive the real interface in a real browser against the real backend in its offline mode, so they need no key, database or internet, and run in CI on every push. They cover: the redirect to sign-in and back; per-field form errors; a kit from a dead company site that says so; a duplicate posting offering the existing kit; a batch upload with one bad entry; one user unable to open another's kit; an edit that is saved, survives a regeneration of its own category, survives a reload, and an undo of that regeneration; keyboard reordering that survives a reload; add, move, delete with undo, and pin; a practice session from the keyboard, the weak-spots report and a re-plan; and the one-page summary reflecting an edit made a moment before. That last test found a real race, since fixed.

Before submission an independent reviewer read this repository against this README and reported twelve defects, each with a scenario: an open redirect through `next`, a reorder during the undo window that corrupted the list, trimmed text overwriting typing, a kit page that could stay on its skeleton after coming back from the summary, a sign-in redirect loop, practice shortcuts swallowing Enter on every button, and others. All are fixed, and `e2e/review-fixes.spec.ts` has a test per scenario so none comes back quietly.

`e2e/production-smoke.spec.ts` runs one full kit against a deployed instance with the real model when `PROD_URL` is set.

## Known limitations

- Reordering is within a category by drag; moving between categories is by select, not by dragging across lists.
- Flashcards reorder with buttons rather than drag.
- There is no offline support: edits made with no connection wait in the queue and are lost if the tab is closed.
- No dark theme.
