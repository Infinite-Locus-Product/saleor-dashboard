export const codHoldSection = "/cod-hold";

export const codHoldQueuePath = `${codHoldSection}/orders`;
export const codHoldOrderDetailPath = (holdId: string) => `${codHoldSection}/orders/${holdId}`;
export const codHoldSettingsPath = `${codHoldSection}/settings`;
