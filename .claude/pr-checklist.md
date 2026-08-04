# PR checklist

Every item below is here because it was missed in review at least once. Each one
names the concrete failure it would have caught, so it can be judged rather than
ticked blindly. Skip what doesn't apply — but skip it deliberately.

## State

- [ ] **Does any state outlive the data it describes?** If a component holds
      state derived from an id (a collection, an order, a product), what happens
      when that id changes while the component stays mounted? React Router v5
      reuses a component across `/thing/A` → `/thing/B`: same route, no remount.
      Refs and `useState` survive.
      _Missed: a "seed once" latch kept collection A's rows on collection B's
      page, and saving there wrote A's ids into B's metadata._

- [ ] **Do "read once at mount" assumptions hold?** Props derived through
      `useForm` / `useStateFromProps` sync in an effect, so they lag one render
      behind props passed straight down. A value captured at mount may belong to
      the previous entity.
      _Missed: `key={id}` was proposed as the fix and would have latched the
      stale value instead — the remount lands inside the lagging render._

- [ ] **Is a state updater doing anything besides computing the next state?**
      Updaters must be pure. StrictMode double-invokes them in dev; concurrent
      rendering may re-run them. Calling a parent `setState` (or anything with a
      side effect) from inside one fires it twice.
      _Missed: `onChange` was called inside `setSelected`/`setItems` updaters._

- [ ] **Does a handler read state from its render closure and then write it?**
      Two calls in one tick both read the same value and the second wins. A
      functional update in the _setter_ doesn't help if the value is computed
      before it.

## Honesty of the UI

- [ ] **Can a failure be told apart from an empty result?** `[]`, `0`, `""` and
      `null` are all valid answers. If failure also produces one of them, the UI
      cannot distinguish "nothing" from "we don't know", and will state the
      wrong one as fact. Track failure separately.
      _Missed: a failed products query rendered "No products in this collection
      yet" to a merchant whose collection had hundreds._

- [ ] **Is `console.error` the only thing a user-facing failure does?** Merchants
      don't have DevTools open. Use `useNotifier` for anything user-visible, and
      keep the console line for developers.

- [ ] **Does the UI act on data it doesn't have?** If a list hasn't loaded,
      anything derived from it must not be persisted. Carry the saved value
      through rather than rebuilding it from an empty screen.
      _Missed: changing a flag before the list loaded would have written
      `order: []` over the collection's real saved order._

- [ ] **Is anything truncated, sampled, or defaulted without saying so?** A
      partial list shown as if complete, or a defaulted `0` shown as a real
      quantity, is the same class of bug as the two above. Disclose it, and
      disable affordances that would act on the missing data.

## Data fetching

- [ ] **Does the cost land on people who don't use the feature?** A card on a
      shared detail page runs its queries on every visit. Load on request unless
      the data is needed to render the page at all.
      _Missed: every Collection detail visit paged the entire collection._

- [ ] **Is the loop over remote data bounded?** `while (hasNextPage)` has no
      ceiling. Cap it, and disclose truncation.

- [ ] **Can the cursor fail to advance?** `hasNextPage: true` with an unchanged
      or null cursor refetches the same page. Break when it doesn't move.

- [ ] **If `errorPolicy: "all"` is set, is `result.errors` actually read?**
      Otherwise field-level errors are silently dropped and their defaults
      (`0`, `null`) are presented as facts.

- [ ] **Do all early returns leave loading state consistent?** An early `return`
      that skips `setLoading(false)` strands skeletons on screen.

## Types and contracts

- [ ] **Does a type predicate check every field it claims?** Narrowing to a type
      whose required fields were never validated hands the rest of the codebase
      values TypeScript believes are strings and aren't.
      _Missed: `productid: string` was required on the type, never checked in the
      parser, and a test asserted entries without it survive._

- [ ] **Optional on read, or validated on read?** Pick one and say which in the
      type. Tolerating a missing field while typing it as required is the worst
      of both.

- [ ] **Does a value cross a repo boundary?** Normalization, casing, and key
      derivation must match the consumer's exactly. Name the counterpart file in
      a comment — they can't share code, so they only stay in step by hand.
      _Missed: colour grouping used `trim().toLowerCase()` while the backend
      matches on `norm` (strip non-alphanumerics); "Sand-Drift" and "Sand Drift"
      disagreed across the boundary._

- [ ] **Does an "upsert" preserve order?** Remove-then-append reshuffles arrays
      that are rendered elsewhere on the same page.

## Accessibility

- [ ] **Does every custom control have an accessible name?** Drag handles, icon
      buttons, and anything a library gives `role="button"` to. Name the row it
      acts on, not just the action — "Reorder Tee, Forged Iron" beats "Reorder"
      when there are thirty handles.

- [ ] **dnd-kit: is `setActivatorNodeRef` used** when the handle is a child of
      the sortable node rather than the node itself?

## i18n

- [ ] **Is every user-visible string in `FormattedMessage` / `intl.formatMessage`?**
      Including `aria-label`s and anything that looks like debug output.

- [ ] **Has `pnpm run extract-messages` been run and committed?** CI runs it and
      then `git diff --exit-code ./locale` — the committed file must match the
      extractor byte for byte. Hand-editing `defaultMessages.json` to keep a diff
      small will fail that job.
      _Missed: called this optional tidy-up; it is enforced, and the branch's
      extraction job was red._

## Verification

- [ ] **Does the new test fail without the fix?** Revert the source change, run
      the test, confirm it fails, restore. A regression test that passes against
      the broken code proves nothing.

- [ ] **Has every claim about behaviour been checked, not reasoned?** Routing,
      remount semantics, and render ordering are cheap to measure with a
      throwaway test and easy to get wrong by reading.
      _Missed: a reproduction path was asserted twice from code reading and was
      wrong — the navigation in question unmounts the component._

- [ ] **Is any logic untested because it sits behind a mock?** If every component
      test mocks a hook, the hook's own branches never run. Say so explicitly
      rather than letting coverage look complete.

## The PR description

- [ ] **Does it document every persisted field?** Not just the ones that felt
      important while writing the code.
      _Missed: the field the consumer is supposed to key on was absent from the
      data model section._

- [ ] **If work is deferred to another ticket, is this the handoff document?**
      Then it must carry the matching contract, the optional-vs-required
      distinction, and anything the consumer has to tolerate.

- [ ] **Is it still true?** Descriptions go stale across review rounds. Re-read
      it before asking for another review.

## Process

- [ ] **Commit and push only when asked.** Approval to commit one thing is not
      approval for the next.

- [ ] **Keep unrelated churn out of the commit.** Generated-file noise from
      earlier commits belongs in its own commit, not folded into a fix.

- [ ] **When a reviewer's prescription is wrong but their diagnosis is right,**
      say both. Implement the fix that works and explain why the suggested one
      doesn't — with the evidence.
