# Decisions

The interface's decision log (its ADRs, kept in one file so they can be read in order): each entry is the situation, the decision and the reason. The pipeline's log is in the backend repository, and its entry 22 covers the generated, edited and pinned state model that this interface renders.

## 1. The kit being edited is derived, never copied

What is shown is the server's kit from the shared cache, unless the user has changes the server has not confirmed, in which case their local version. The local version is dropped only when the save queue runs dry. Keeping a second copy in component state and reconciling it on every answer was the first design, and it produced exactly the bug it invites: an answer that arrived late overwrote newer typing. With one derived value there is nothing to reconcile.

## 2. A change is data, and the queue that sends it knows nothing about React

Every edit, reorder, move, pin and delete is a small object (`kit-ops.ts`) that knows how to apply itself locally and which request it becomes. A plain class (`save-queue.ts`) sends them one at a time, in order, merging a burst of typing into one request. Because a change is data it can be merged, retried, tested without a browser, and, later, written down (decision 6). The framework's lint rules against self-referencing callbacks and state set in effects pushed in the same direction: the rules of saving do not belong in a hook.

## 3. One small request per change, never the whole kit

Sending the whole kit back would let a background regeneration and a user's edit overwrite each other. Small operations against a versioned save on the server cannot: whichever lands second is applied on top of the first.

## 4. `/api` is proxied, so the session cookie is first-party

The backend lives on another host. Rewriting `/api/*` to it keeps the cookie first-party, which avoids third-party cookie blocking and any need for CORS with credentials in the browser. `proxy.ts` only checks that a cookie is present; the API is the authority, and any 401 ends the session and sends the user to sign in with a way back.

## 5. Polling for job progress

A job is polled every two seconds rather than streamed. Long-lived connections through a rewrite and a sleeping free-tier host are fragile; a two-second poll of a small document is not, and it survives a closed laptop lid.

## 6. Unsaved edits are written down, because changes are idempotent

Edits made offline were lost if the tab closed. The queue now records what is unconfirmed in the browser's storage and crosses items off as the server confirms them. Replaying is safe because text is set, an order is set, a pin is set; only a delete can be refused the second time, which is the wanted outcome. Two things review caught and that are now handled: changes handed to the page's exit delivery stay recorded until that delivery reports each one, alongside the one still in flight in the queue, since either could otherwise erase the other's record; and storage is validated field by field for every kind of change, since a bare `{ "type": "reorderQuestions" }` would have crashed the page that loaded it. A list that fails validation is discarded whole, because changes depend on the ones before them.

## 7. Dark theme by turning the scales over, not by a variant on every class

The components already pair colours for contrast. Adding a `dark:` variant to several hundred classes would restate every pair and leave the next component light by default. Redefining the colour scales under `data-theme="dark"` keeps every pair's contrast and makes new components dark without anyone remembering. `bg-white` became a named surface token, because a surface is a role and not a colour; the sign-in hero is dark in both themes, so its colours are fixed. The script that sets the theme before the first paint lives in a module with no `"use client"`, because the root layout is a server component and needs the text itself. What keeps the approach honest is decision 8.

## 8. Accessibility is scanned, in both themes, with nothing excluded

Keyboard flows were tested step by step from the start, but nothing checked contrast, labels, roles or landmarks. An axe scan now covers every screen, dialog and error state in light and dark at two widths. Two intermittent failures taught something about measuring rather than about the app: text fading in is measured at a colour nobody reads, so the scan asks for reduced motion, which the app honours; and a tab change makes the framework swap the document title for an identical one with a moment in between when there is none, so the scan waits for that refresh to finish.

## 9. The run trace is fetched only when opened

It is the largest thing a kit has, and most visits never look at it. It is a separate request made when the panel opens, the panel is absent for kits made before runs were recorded, and its loading and empty states are announced, not only drawn.

## 10. One drag context for all four question lists

Each list used to own its drag, which is why a question could not leave its category by dragging. The tab now owns the drag and each list only says which questions sort together; a category's whole section is a drop target, which is what makes an empty category reachable. Across lists the drop becomes the same "move" the category select already made, so the server's rules, the pin it implies and the regeneration rules did not change. Flashcards sit in a grid, so their sorting strategy is the two-dimensional one; the vertical one shuffles the wrong cards on a sideways drag.

## 11. Pull requests after the first deployment

The base interface was built on `main`. After it was deployed, every change went through a pull request with CI (typecheck, lint, the browser suite against the backend's offline mode), an automated reviewer whose comments were each fixed or answered, and a preview deployment. Production follows `main`, so it was never disturbed by work in progress.
