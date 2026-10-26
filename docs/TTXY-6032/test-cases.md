# TTXY-6032 — CX Return Rejection & Pincode Visibility: test cases

Jira: TTXY-6032 (BE TTXY-6034, Dashboard TTXY-6041) · PN: https://zapgift.atlassian.net/wiki/spaces/TXY/pages/3623845889
Branch: `feat/TTXY-6032-cx-return-reject` (TenexuBackend ← `production`, saleor-dashboard ← `main`)

Run (BE): `npx jest --config jest.config.ts --testPathPattern=cxReturnReject` (and the other paths listed per section). Never the full suite locally; the pre-push gate runs it.
Run (Dashboard): `npx jest src/returns-exchange` · Playwright: `npx playwright test playwright/tests/returnsExchange --project=e2e (needs a running dashboard + Saleor login; see test report)`

Legend: `[ ]` not written · `[x]` written and green. **(R)** = regression guard on existing behaviour.

## A. Backend — closed-status constant (`tests/unit/cxReturnReject.status.test.ts`)

- [x] A1 `CX_CLOSED_STATUSES` contains APPROVED, AUTO_APPROVED, EXCHANGED, RETURN_REJECTED, and nothing else.
- [x] A2 `CX_OPEN_STATUSES` is exactly RETURN_PENDING, CX_REVIEW, CX_ACTION.
- [x] A3 `CLOSED_STATUS_SQL` is `'APPROVED','AUTO_APPROVED','EXCHANGED','RETURN_REJECTED'` (used in every raw SQL).
- [x] A4 `VALID_TRANSITIONS`: RETURN_REJECTED is reachable from RETURN_PENDING, CX_REVIEW and CX_ACTION, and has no outgoing transitions.
- [x] A5 `getSLATier` returns SAFE with `null` hours for RETURN_REJECTED, even if `auto_approval_due_at` is set.
- [x] A6 No source file under `src/` still hard-codes `('APPROVED','AUTO_APPROVED','EXCHANGED')` or its spaced variant (grep guard test).

## B. Backend — reject service (`tests/unit/cxReturnReject.service.test.ts`)

- [x] B1 Rejects a RETURN*PENDING request: one conditional UPDATE sets `cx_status='RETURN_REJECTED'`, the reason, `rejected_by_id`, `rejected_by_name`, `rejected_at`, `last_activity*\*`, and `auto_approval_due_at = NULL`.
- [x] B2 Same for CX_REVIEW and CX_ACTION.
- [x] B3 The UPDATE's WHERE clause restricts to open statuses, so a request closed between read and write updates 0 rows → `ALREADY_CLOSED` (409).
- [x] B4 Request already APPROVED / AUTO_APPROVED / EXCHANGED / RETURN_REJECTED → `ALREADY_CLOSED` (409), and nothing is written.
- [x] B5 Unknown request id → `NOT_FOUND` (404).
- [x] B6 Reason is trimmed: 10 chars OK, 9 chars → `INVALID_REASON` (400), 500 chars OK, 501 → 400, whitespace-only → 400, missing / non-string → 400.
- [x] B7 Writes a `STATUS_CHANGED {from,to}` audit entry and a `RETURN_REJECTED` audit entry whose context holds the reason, with the actor taken from the verified agent.
- [x] B8 Inserts `RETURN_REJECTED` into `tenxyou_fulfillment_status` for the REQ id and calls `updateOrderStatusTable(orderId, REQ, "RETURN_REJECTED")`.
- [x] B9 A failure in the status-table writes (B8) is logged and does not undo or fail the rejection.
- [x] B10 No ERP notify, no Saleor call and no customer notification on reject.

## C. Backend — reject route / controller (`tests/unit/cxReturnReject.routes.test.ts`)

- [x] C1 `POST /cx/returns/:requestId/reject` is mounted behind `requireCXPermission` (401/403 without it).
- [x] C2 The agent comes from `req.cxAgent`; `cx_agent_id` / `cx_agent_name` in the body are ignored.
- [x] C3 200 → `{ ok: true, data: <updated request> }` with `cx_status: "RETURN_REJECTED"`, `rejection_reason`, `rejected_by_name`, `rejected_at`.
- [x] C4 Error mapping: INVALID_REASON → 400, NOT_FOUND → 404, ALREADY_CLOSED → 409, anything else → 500 with a generic message.

## D. Backend — closed everywhere (`tests/unit/cxReturnReject.closedEverywhere.test.ts`)

- [x] D1 Auto-approval sweep SQL excludes RETURN_REJECTED.
- [x] D2 Auto-approval re-reads the row's status right before approving; if it's now closed (e.g. rejected seconds earlier) it skips the row with no Saleor call.
- [x] D3 SLA monitor (email alerts) SQL excludes RETURN_REJECTED.
- [x] D4 Log Call on a closed request (incl. RETURN_REJECTED) → refused (409), no call row and no timer reset.
- [x] D5 (R) Log Call on an open request still inserts the log, resets the timer and moves PENDING→CX_REVIEW→CX_ACTION as today.
- [x] D6 `resetAutoApprovalTimer` only updates rows whose status is open (SQL guard), so a call can never re-arm a closed request.
- [x] D7 Mark Unreachable on a closed request → refused (409).
- [x] D8 Approve on RETURN_REJECTED → 409 "already closed" before any Saleor call (today it is a 500).
- [x] D9 Convert-to-exchange on RETURN_REJECTED → refused before any Saleor call (no return, no replacement order).
- [x] D10 (R) Approve and convert-to-exchange on open requests are unchanged.
- [x] D11 Active count still counts only open statuses.
- [x] D12 Detail GET on a RETURN_REJECTED request does not change its status (the PENDING→CX_REVIEW side effect only applies to PENDING).
- [x] D13 `updateStatus` writes only if the status is still the one it read (`AND cx_status=$5`); a status changed in between (reject landed mid-approve/convert) → ALREADY_CLOSED 409, nothing audited (`cxReturnReject.updateStatusRace.test.ts`).

## E. Backend — customer submission block (`tests/unit/cxReturnReject.submissionBlock.test.ts`)

- [x] E1 `getRejectedFulfillmentLineIds(orderId)` returns every `fulfillmentLineId` in `fulfillment_lines_input` of the order's RETURN_REJECTED requests (one query per order).
- [x] E2 `POST /saleor/return-fulfillment` with a line covered by a rejected request → 4xx with code `RETURN_REJECTED_LINE` and the message "A return for this item was rejected, so it can't be returned or exchanged. Please contact support.", and no CX request is created.
- [x] E3 Same request with a mix of a rejected line and a clean line → the whole request is refused (nothing partial is created).
- [x] E4 (R) A return on a different line of the same fulfillment / order is accepted.
- [x] E5 `POST /saleor/create-exchange-request` on a rejected line → refused with the same code, before any Saleor call.
- [x] E6 (R) Exchange on a clean line is unchanged.
- [x] E7 The whole line is blocked: a 2-unit line where the rejected request covered 1 unit → both units are refused.
- [x] E8 If the rejected-lines lookup fails (DB error) the submission fails closed with 500 (it does not let the return through).

## F. Backend — customer order views (`tests/unit/cxReturnReject.orderViews.test.ts`)

- [x] F1 `injectPendingReturns` ignores RETURN_REJECTED requests: no synthetic `cx-return-` fulfillment, and the item quantity is not removed from the original shipment.
- [x] F2 Items on lines covered by a rejected request get `isReturnable=false`, `isExchangeable=false`, `returnRejected=true` and `exchange_return_reasons=["Return rejected"]` (order list and order detail).
- [x] F3 (R) Other items in the same shipment keep their computed flags and reasons.
- [x] F4 `stripPendingReturnItemsFromShipments` (shipment detail) ignores rejected requests and the shipment detail item is flagged as in F2.
- [x] F5 `buildShipmentResponseForPendingReturn` for a RETURN_REJECTED request returns status "Return Rejected" and tracker `[Return Requested ✓, Return Rejected ✓ isCancelled]` with no Return/Exchange CTA.
- [x] F6 (R) The same builder for an open request is unchanged ("Return Requested").
- [x] F7 Family-root grouping (`getPendingReturnRequestsAgainstFulfillmentIds`) excludes RETURN_REJECTED.

## G. Backend — Sagepilot, returns-by-phone, manual flows (`tests/unit/cxReturnReject.integrations.test.ts`)

- [x] G1 Sagepilot `applyPendingReturns` ignores rejected requests (the item stays in its original fulfillment).
- [x] G2 Sagepilot return-eligibility: a rejected line → `isReturnable=false`, `isExchangeable=false`, reason `NOT_ELIGIBLE`, no `return_link` / `exchange_link`.
- [x] G3 (R) Sagepilot: a pending (open) request still yields reason `RETURN_REQUESTED`; a clean line is unchanged.
- [x] G4 `RETURN_STATUSES` includes RETURN_REJECTED; `RETURN_STATUS_DISPLAY.RETURN_REJECTED = "Return Rejected"`; priority puts it above RETURN_REQUESTED for the same pair.
- [x] G5 Returns-by-phone shows a rejected REQ as "Return Rejected".
- [x] G6 Manual Return eligibility: a rejected request no longer claims its line (eligibleQuantity is the full line).
- [x] G7 Manual Exchange claim map ignores RETURN_REJECTED requests (the line is eligible).
- [x] G8 (R) Manual Return / Manual Exchange still treat open and approved/exchanged requests as before.
- [x] G9 (R) Update the existing `cxManualReturn.lookup` SQL assertion to the new closed list.

## H. Backend — pincode (`tests/unit/cxReturnReject.pincode.test.ts`)

- [x] H1 `listReturns` selects `delivery_address->>'postalCode' AS pincode` on every row (null when there's no address).
- [x] H2 `pincode=560001` adds `r.delivery_address->>'postalCode' = $n` to both the data and the count queries (before LIMIT/OFFSET).
- [x] H3 `pincode` that isn't exactly 6 digits (`56000`, `5600011`, `56000a`, `560001` after trim is OK) → 400 `INVALID_PINCODE` from the controller.
- [x] H4 Combines with status, search and page (all params bound in order; no SQL injection: the value is a bound parameter).
- [x] H5 Applies to every status, including closed ones (no implicit status filter is added).
- [x] H6 `getReturnById` (detail) also returns `pincode`.

## I. Backend — migration (`tests/unit/cxReturnReject.migration.test.ts`)

- [x] I1 Adds `rejection_reason`, `rejected_by_id`, `rejected_by_name`, `rejected_at` with `IF NOT EXISTS`.
- [x] I2 Creates the pincode expression index with `IF NOT EXISTS`.
- [x] I3 Recreates `idx_cx_return_requests_due` with the 4-status closed list.
- [x] I4 Runs in one transaction and rolls back on error.

## J. Dashboard — unit (Jest, `src/returns-exchange/**`)

- [x] J1 `utils/cxReturnStatus.ts`: `CX_CLOSED_STATUSES` includes RETURN_REJECTED; `isClosedStatus()` works for all 7 statuses.
- [x] J2 `StatusChip` renders "Rejected" with the `critical1` colour for RETURN_REJECTED.
- [x] J3 `returnsApi.submitRejectReturn(requestId, reason)` POSTs `/cx/returns/:id/reject` with `{ reason }` and the auth headers; error message from the API is surfaced.
- [x] J4 `fetchReturns` sends `pincode` only when set.
- [x] J5 Queue: a Pincode column right after Order #, showing the value or "—".
- [x] J6 Queue: the pincode filter accepts exactly 6 digits; anything else shows an inline message and does not refetch.
- [x] J7 Queue: applying the pincode filter resets to page 1 and refetches with `pincode` + the other active filters.
- [x] J8 Queue: no results with a pincode → message names the pincode and offers "Clear pincode", which restores the list.
- [x] J9 Queue: "Rejected" is a status chip; the SLA badge is hidden on closed rows.
- [x] J10 Detail: "Reject Return" shows on open requests and is absent on closed ones.
- [x] J11 Detail: the dialog's confirm is disabled until the trimmed reason is 10–500 chars; the counter updates.
- [x] J12 Detail: warning "No calls have been logged with this customer." shows when there are 0 calls.
- [x] J13 Detail: warning "The customer agreed to an exchange on the last call." shows when the last call's user action is "Agreed to exchange".
- [x] J14 Detail: confirm calls `submitRejectReturn`, closes the dialog, reloads, and shows a success toast; on API error shows an error toast and keeps the dialog open.
- [x] J15 Detail: a RETURN_REJECTED request is read-only (no Log Call / Approve / Convert / CX actions), shows the red "Return Rejected" pill, and the sidebar shows the reason, "Rejected by <agent>" and the time.
- [x] J16 Detail: the timeline renders the reject entry's reason.

## K. Dashboard — Playwright E2E (`playwright/tests/returnsExchange/*.spec.ts`, API mocked via `page.route`)

- [x] K1 Reject happy path: open a Pending request → Reject → type a reason → confirm → the page turns read-only with the "Return Rejected" pill and the reason.
- [x] K2 Reject validation: confirm disabled for a 9-char reason, enabled at 10; 501 chars is not accepted.
- [x] K3 Warnings shown for a request with no calls, and for "Agreed to exchange".
- [x] K4 Reject API returns 409 → error toast, dialog stays open.
- [x] K5 Pincode column after Order # and "—" for a missing pincode.
- [x] K6 Pincode filter: invalid entry shows an inline message; valid entry refetches with `pincode`, page back to 1; no-results message + Clear restores the list.
- [x] K7 Pincode + status chip combine in the request query.
- [x] K8 Logged-out user opening the queue URL is sent to the login page (existing auth).
