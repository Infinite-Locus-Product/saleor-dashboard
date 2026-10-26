import {
  type LookupItem,
  type LookupResult,
  type LookupShipment,
  type ManualReturnDetail,
  type ManualReturnListItem,
  type ReturnReason,
} from "./types";

export const returnReasonsFixture: ReturnReason[] = [
  { id: 1, reason: "Size issue", requires_note: false },
  { id: 2, reason: "Damaged product", requires_note: false },
  { id: 3, reason: "Other (please specify)", requires_note: true },
];

const baseLookupItem: LookupItem = {
  fulfillmentId: "F1",
  fulfillmentLineId: "FL1",
  orderLineId: "OL1",
  variantId: "V1",
  productId: "P1",
  productName: "Linen Shirt",
  sku: "SKU-LINEN-M",
  size: "M",
  colour: "Blue",
  unitPrice: 1299,
  estimatedRefundPerUnit: 1199,
  currency: "INR",
  quantity: 2,
  eligibleQuantity: 2,
  claimedQuantity: 0,
  claimRequestId: null,
  claimStatus: null,
  classification: "eligible",
  disabledReason: null,
  orderStatus: "DELIVERED",
  deliveredAt: "2026-09-10T10:00:00Z",
  daysSinceDelivery: 5,
  windowDays: 7,
  withinWindow: true,
  isReturnable: true,
  overrideReasons: [],
  requiresOverride: false,
};

export const makeLookupItem = (overrides: Partial<LookupItem> = {}): LookupItem => ({
  ...baseLookupItem,
  ...overrides,
});

/** Eligible, in window, 2 units. */
export const linenShirtItem: LookupItem = makeLookupItem();

/** Eligible but needs an override for two reasons. */
export const denimJacketItem: LookupItem = makeLookupItem({
  fulfillmentLineId: "FL2",
  orderLineId: "OL2",
  variantId: "V2",
  productId: "P2",
  productName: "Denim Jacket",
  sku: "SKU-DENIM-L",
  size: "L",
  colour: "Indigo",
  unitPrice: 3499,
  estimatedRefundPerUnit: 3299,
  quantity: 1,
  eligibleQuantity: 1,
  daysSinceDelivery: 12,
  withinWindow: false,
  isReturnable: false,
  overrideReasons: ["window_exceeded", "not_returnable"],
  requiresOverride: true,
});

/** Already claimed by a pending customer return. */
export const cottonTeeItem: LookupItem = makeLookupItem({
  fulfillmentLineId: "FL3",
  orderLineId: "OL3",
  productName: "Cotton Tee",
  sku: "SKU-TEE-S",
  size: "S",
  quantity: 1,
  eligibleQuantity: 0,
  claimedQuantity: 1,
  claimRequestId: "REQ-0042",
  claimStatus: "CX_REVIEW",
  classification: "already_claimed",
  disabledReason: "Return REQ-0042 · CX_REVIEW",
});

/** Shipped, not delivered. */
export const chinoPantsItem: LookupItem = makeLookupItem({
  fulfillmentId: "F2",
  fulfillmentLineId: "FL4",
  orderLineId: "OL4",
  productName: "Chino Pants",
  sku: "SKU-CHINO-32",
  size: "32",
  quantity: 1,
  eligibleQuantity: 0,
  classification: "in_transit",
  disabledReason: "Status: OUT_FOR_DELIVERY",
  orderStatus: "OUT_FOR_DELIVERY",
  deliveredAt: null,
  daysSinceDelivery: null,
});

/** Never shipped. */
export const silkTieItem: LookupItem = makeLookupItem({
  fulfillmentId: null,
  fulfillmentLineId: null,
  orderLineId: "OL5",
  productName: "Silk Tie",
  sku: "SKU-TIE",
  size: null,
  quantity: 1,
  eligibleQuantity: 0,
  classification: "unfulfilled",
  disabledReason: "Not yet shipped",
  orderStatus: null,
  deliveredAt: null,
  daysSinceDelivery: null,
});

/** Unit sits in a returned / cancelled-return fulfillment. */
export const woolScarfItem: LookupItem = makeLookupItem({
  fulfillmentId: "F3",
  fulfillmentLineId: "FL6",
  orderLineId: "OL6",
  productName: "Wool Scarf",
  sku: "SKU-SCARF",
  size: null,
  quantity: 1,
  eligibleQuantity: 0,
  classification: "returned_or_cancelled",
  disabledReason: "Return REQ-0007 · RETURN_CANCELLED",
  orderStatus: "RETURN_CANCELLED",
});

export const deliveredShipment: LookupShipment = {
  fulfillmentId: "F1",
  fulfillmentStatus: "FULFILLED",
  orderStatus: "DELIVERED",
  deliveredAt: "2026-09-10T10:00:00Z",
  items: [linenShirtItem, denimJacketItem, cottonTeeItem],
};

export const inTransitShipment: LookupShipment = {
  fulfillmentId: "F2",
  fulfillmentStatus: "FULFILLED",
  orderStatus: "OUT_FOR_DELIVERY",
  deliveredAt: null,
  items: [chinoPantsItem],
};

export const returnedShipment: LookupShipment = {
  fulfillmentId: "F3",
  fulfillmentStatus: "RETURNED",
  orderStatus: "RETURN_CANCELLED",
  deliveredAt: "2026-09-02T10:00:00Z",
  items: [woolScarfItem],
};

export const makeLookupResult = (overrides: Partial<LookupResult> = {}): LookupResult => ({
  orderId: "T3JkZXI6MTAwMQ==",
  orderNumber: "1001",
  orderStatus: "FULFILLED",
  orderCreated: "2026-09-01T10:00:00Z",
  customerName: "Asha Rao",
  customerEmail: "asha@example.com",
  customerPhone: "+919876543210",
  pickupAddress: {
    name: "Asha Rao",
    phone: "+919876543210",
    streetAddress1: "12 MG Road",
    streetAddress2: "Flat 4B",
    city: "Bengaluru",
    postalCode: "560001",
    countryArea: "Karnataka",
    country: "IN",
  },
  paymentMethod: "PREPAID",
  requiresRefundContact: false,
  currency: "INR",
  hasEligibleItems: true,
  shipments: [deliveredShipment, inTransitShipment, returnedShipment],
  unfulfilledItems: [silkTieItem],
  ...overrides,
});

export const makeListItem = (
  overrides: Partial<ManualReturnListItem> = {},
): ManualReturnListItem => ({
  mr_id: "MR-0042",
  saleor_order_id: "T3JkZXI6MTAwMQ==",
  saleor_order_number: "1001",
  customer_name: "Asha Rao",
  customer_email: "asha@example.com",
  customer_phone: "+919876543210",
  lines: [
    {
      fulfillmentLineId: "FL1",
      orderLineId: "OL1",
      variantId: "V1",
      productId: "P1",
      productName: "Linen Shirt",
      sku: "SKU-LINEN-M",
      size: "M",
      colour: "Blue",
      quantity: 1,
      eligibleQuantity: 2,
      unitPrice: 1299,
      estimatedRefundPerUnit: 1199,
      overrideReasons: [],
    },
  ],
  cx_agent_name: "Ravi Kumar",
  created_at: "2026-09-14T09:30:00Z",
  return_status: "RETURN_PICKED_UP",
  return_status_label: "Return Picked Up",
  erp_sync_status: "PENDING",
  is_override: false,
  payment_method: "COD",
  ...overrides,
});

export const makeDetail = (overrides: Partial<ManualReturnDetail> = {}): ManualReturnDetail => ({
  ...makeListItem(),
  lines: [
    {
      fulfillmentLineId: "FL1",
      orderLineId: "OL1",
      variantId: "V1",
      productId: "P1",
      productName: "Linen Shirt",
      sku: "SKU-LINEN-M",
      size: "M",
      colour: "Blue",
      quantity: 1,
      eligibleQuantity: 2,
      unitPrice: 1299,
      estimatedRefundPerUnit: 1199,
      overrideReasons: ["window_exceeded"],
    },
  ],
  is_override: true,
  creation_status: "COMPLETED",
  original_fulfillment_id: "F1",
  saleor_return_fulfillment_id: "RF1",
  return_reason: "Size issue",
  override_note: "Customer was travelling and could not return in time",
  override_reasons: ["window_exceeded"],
  estimated_refund_amount: 1199,
  currency: "INR",
  refund_email: "asha@example.com",
  refund_upi: "asha@okaxis",
  pickup_address: {
    name: "Asha Rao",
    phone: "+919876543210",
    streetAddress1: "12 MG Road",
    streetAddress2: null,
    city: "Bengaluru",
    postalCode: "560001",
    countryArea: "Karnataka",
    country: "IN",
  },
  cx_agent_id: "VXNlcjo3",
  cx_agent_email: "ravi@tenxyou.com",
  erp_sync_attempts: 0,
  erp_sync_last_error: null,
  erp_sync_acknowledged_at: null,
  refund: {
    provider: null,
    status: null,
    status_label: null,
    amount: null,
    reference_id: null,
    failure_reason: null,
  },
  ...overrides,
});
