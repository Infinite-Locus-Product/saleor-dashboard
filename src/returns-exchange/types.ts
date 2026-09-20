export type CXReturnStatus =
  | "RETURN_PENDING"
  | "CX_REVIEW"
  | "CX_ACTION"
  | "EXCHANGED"
  | "APPROVED"
  | "AUTO_APPROVED";

export type SLATier = "SAFE" | "AT_RISK" | "CRITICAL";
export type CXCallOutcome = "Answered" | "No Answer" | "Busy" | "Callback Requested";
export type CXUserAction = "Agreed to exchange" | "Disagreed to exchange" | "User Unreachable";

export interface CXReturnRequest {
  id: number;
  request_id: string;
  saleor_order_id: string;
  saleor_order_number: string;
  saleor_fulfillment_id: string;
  saleor_return_fulfillment_id: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  delivery_address: Record<string, any> | null;
  payment_method: "COD" | "PREPAID" | null;
  order_placed_at: string | null;
  delivery_date: string | null;
  product_name: string | null;
  product_sku: string | null;
  product_size: string | null;
  product_colour: string | null;
  product_variant_id: string | null;
  product_id: string | null;
  return_reason: string | null;
  customer_images: string[] | null;
  cod_refund_email: string | null;
  cx_status: CXReturnStatus;
  last_activity_at: string;
  auto_approval_due_at: string | null;
  customer_unreachable: boolean;
  replacement_order_id: string | null;
  replacement_order_number: string | null;
  erp_sync_status: string | null;
  created_at: string;
  updated_at: string;
  last_activity_by_id: string | null;
  last_activity_by_name: string | null;
  // Computed
  sla_tier: SLATier;
  sla_hours_remaining: number | null;
  call_count: number;
  last_call_outcome: string | null;
  last_call_user_action: string | null;
}

export interface CXCallLog {
  id: number;
  request_id: string;
  call_number: number;
  cx_agent_id: string;
  cx_agent_name: string;
  outcome: CXCallOutcome;
  user_action: CXUserAction | null;
  notes: string;
  callback_date: string | null;
  callback_time: string | null;
  created_at: string;
}

export interface CXAuditEntry {
  id: number;
  entity_type: string;
  entity_id: string;
  actor_type: string;
  actor_id: string | null;
  actor_name: string | null;
  action_type: string;
  context: Record<string, any> | null;
  created_at: string;
}

export interface CXEligibility {
  isExchangeable: boolean;
  withinWindow: boolean;
  daysInWindow: number;
  windowDays: number;
  requiresOverride: boolean;
  overrideReasons: string[];
}

export interface CXReturnDetail extends CXReturnRequest {
  call_logs: CXCallLog[];
  audit_trail: CXAuditEntry[];
  last_user_action: CXUserAction | null;
  eligibility: CXEligibility | null;
}

export interface CXManualExchange {
  id: number;
  mx_id: string;
  original_order_id: string;
  original_order_number: string;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  item_sku: string | null;
  item_name: string | null;
  item_size: string | null;
  item_colour: string | null;
  item_variant_id: string | null;
  replacement_variant_id: string | null;
  replacement_size: string | null;
  replacement_colour: string | null;
  replacement_order_id: string | null;
  replacement_order_number: string | null;
  cx_agent_id: string;
  cx_agent_name: string;
  override_reason: string | null;
  erp_sync_status: string;
  created_at: string;
}

export interface NotificationSettings {
  AT_RISK_EMAILS: string[];
  AT_RISK_THRESHOLD: number;
  CRITICAL_EMAILS: string[];
  CRITICAL_THRESHOLD: number;
  ERP_SYNC_EMAILS: string[];
  AUTO_APPROVAL_EMAILS: string[];
  EXCHANGE_ORDER_EMAILS: string[];
  WEBHOOK_FAIL_EMAILS: string[];
  REFUND_FAIL_EMAILS: string[];
}

// ─── Manual Returns (see TenexuBackend docs/manual-return/LLD.md §3) ─────────

export type ManualReturnPaymentMethod = "COD" | "PREPAID";
export type ManualReturnErpSyncStatus = "PENDING" | "SUCCESS" | "FAILED";
export type OverrideReason = "window_exceeded" | "not_returnable" | "cant_return_flag";
export type LookupClassification =
  | "eligible"
  | "in_transit"
  | "already_claimed"
  | "unfulfilled"
  | "returned_or_cancelled";

export interface ReturnReason {
  id: number;
  reason: string;
  /** Backend flag: this reason cannot be submitted without a note (e.g. "Other (please specify)"). */
  requires_note?: boolean;
}

export interface PickupAddress {
  name: string;
  phone: string | null;
  streetAddress1: string;
  streetAddress2: string | null;
  city: string;
  postalCode: string;
  countryArea: string | null;
  country: string | null;
}

export interface LookupItem {
  fulfillmentId: string | null;
  fulfillmentLineId: string | null;
  orderLineId: string;
  variantId: string | null;
  productId: string | null;
  productName: string;
  sku: string | null;
  size: string | null;
  colour: string | null;
  unitPrice: number;
  estimatedRefundPerUnit: number;
  currency: string;
  /** Units on this fulfillment line (or the unfulfilled remainder). */
  quantity: number;
  /** Selectable units (0 unless classification = eligible). */
  eligibleQuantity: number;
  claimedQuantity: number;
  claimRequestId: string | null;
  claimStatus: string | null;
  classification: LookupClassification;
  /** Human text for non-selectable rows. */
  disabledReason: string | null;
  orderStatus: string | null;
  deliveredAt: string | null;
  daysSinceDelivery: number | null;
  windowDays: number;
  withinWindow: boolean;
  isReturnable: boolean;
  overrideReasons: OverrideReason[];
  requiresOverride: boolean;
}

export interface LookupShipment {
  fulfillmentId: string;
  fulfillmentStatus: string;
  orderStatus: string | null;
  deliveredAt: string | null;
  items: LookupItem[];
}

export interface LookupResult {
  orderId: string;
  orderNumber: string;
  orderStatus: string;
  orderCreated: string;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  pickupAddress: PickupAddress | null;
  paymentMethod: ManualReturnPaymentMethod;
  requiresRefundContact: boolean;
  currency: string;
  hasEligibleItems: boolean;
  shipments: LookupShipment[];
  unfulfilledItems: LookupItem[];
}

export interface ManualReturnLine {
  fulfillmentLineId: string;
  orderLineId: string;
  variantId: string | null;
  productId: string | null;
  productName: string;
  sku: string | null;
  size: string | null;
  colour: string | null;
  /** Units returned in this MR. */
  quantity: number;
  /** Eligible units at submit time ("1 of 2 eligible"). */
  eligibleQuantity: number;
  unitPrice: number;
  estimatedRefundPerUnit: number;
  overrideReasons: OverrideReason[];
}

export interface ManualReturnListItem {
  mr_id: string;
  saleor_order_id: string;
  saleor_order_number: string;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  lines: ManualReturnLine[];
  cx_agent_name: string;
  created_at: string;
  return_status: string;
  return_status_label: string;
  erp_sync_status: ManualReturnErpSyncStatus;
  is_override: boolean;
  payment_method: ManualReturnPaymentMethod;
}

export interface ManualReturnRefund {
  provider: "EASEBUZZ" | "GOKWIK" | null;
  status: string | null;
  status_label: string | null;
  amount: number | null;
  reference_id: string | null;
  failure_reason: string | null;
}

export interface ManualReturnDetail extends ManualReturnListItem {
  creation_status: "INCOMPLETE" | "COMPLETED" | "FAILED";
  original_fulfillment_id: string;
  saleor_return_fulfillment_id: string | null;
  return_reason: string;
  override_note: string | null;
  override_reasons: OverrideReason[];
  estimated_refund_amount: number;
  currency: string;
  refund_email: string | null;
  refund_upi: string | null;
  pickup_address: PickupAddress | null;
  cx_agent_id: string;
  cx_agent_email: string | null;
  erp_sync_attempts: number;
  erp_sync_last_error: string | null;
  erp_sync_acknowledged_at: string | null;
  refund: ManualReturnRefund;
}

export interface ManualReturnListFilters {
  search?: string;
  status?: string;
  erpSyncStatus?: string;
}

export interface ManualReturnPagination {
  total: number;
  page: number;
  limit: number;
}

export interface CreateManualReturnPayload {
  order_number: string;
  /** UUID generated by the dashboard, reused on retry. */
  idempotency_key: string;
  reason_id: number;
  override_note?: string;
  refund_email?: string;
  refund_upi?: string;
  lines: Array<{ fulfillment_line_id: string; quantity: number }>;
}

export interface CreateManualReturnShipmentResult {
  originalFulfillmentId: string;
  ok: boolean;
  mrId?: string;
  creationStatus?: "COMPLETED" | "INCOMPLETE";
  code?: string;
  message?: string;
}

export interface CreateManualReturnResult {
  /** HTTP status: 201 (all shipments ok) or 207 (mixed). */
  status: number;
  ok: boolean;
  results: CreateManualReturnShipmentResult[];
}

export interface ProductVariant {
  id: string;
  name: string;
  sku: string;
  quantityAvailable: number;
  attributes: Array<{
    attribute: {
      name: string;
    };
    values: Array<{
      name: string;
    }>;
  }>;
}
