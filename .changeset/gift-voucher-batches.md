---
"saleor-dashboard": minor
---

Gift cards now work as TenXYou gift vouchers. "Create batch" replaces "Issue card" and asks for a batch name (a new tag) and a 6-letter `TX` code prefix; every code is active and expires 12 months from issue. A batch value is whole rupees in INR only. A new Batches page lists each batch with its totals (100 per page, with Previous / Next; Redeemed counts only what orders spent, not staff balance changes), and a batch's gift card list shows a summary card with a "Download codes" CSV button. The full code is shown in the list and on the card page, "Set balance" changes only the current balance and needs a reason saved in the history, fully used cards show "Exhausted", and the Delete buttons are hidden.
