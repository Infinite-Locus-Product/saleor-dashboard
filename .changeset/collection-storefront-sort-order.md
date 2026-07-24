---
"saleor-dashboard": minor
---

Add storefront sort-order management to the Collection detail page. Merchants can now pin colour-level product rows, drag to order them, sort by available inventory, and set two collection-level display flags (`show_only_tagged_variants`, `is_filter_variants`). The order and flags are persisted in the collection's public `sorting_order` metadata, replacing the previous Strapi-based ordering. Legacy bare-array metadata values remain readable.
