import { TimePeriodTypeEnum } from "@dashboard/graphql";

import { type GiftCardBulkCreateFormData } from "./types";
import { validateForm } from "./utils";

const formData = (
  overrides: Partial<GiftCardBulkCreateFormData> = {},
): GiftCardBulkCreateFormData => ({
  tags: "Spinny Diwali 2026",
  balanceAmount: 5000,
  balanceCurrency: "INR",
  expirySelected: false,
  expiryType: "EXPIRY_PERIOD",
  expiryDate: "",
  expiryPeriodType: TimePeriodTypeEnum.MONTH,
  expiryPeriodAmount: 12,
  requiresActivation: false,
  cardsAmount: 100,
  prefix: "TXYSPN",
  ...overrides,
});

describe("GiftCardBulkCreateDialog validateForm", () => {
  it("accepts a TX prefix and one tag", () => {
    // Arrange
    const data = formData();

    // Act
    const errors = validateForm(data);

    // Assert
    expect(errors).toEqual({});
  });

  it.each(["", "TXYSP", "YOUARE", "txyspn", "TX12AB"])("refuses the prefix %p", prefix => {
    // Arrange
    const data = formData({ prefix });

    // Act
    const errors = validateForm(data);

    // Assert
    expect(errors.prefix).toBeDefined();
  });

  it.each([0, 100.5])("refuses the value %p", balanceAmount => {
    // Arrange
    const data = formData({ balanceAmount });

    // Act
    const errors = validateForm(data);

    // Assert
    expect(errors.balance).toBeDefined();
  });

  it.each(["", "   "])("refuses the batch name %p", tags => {
    // Arrange
    const data = formData({ tags });

    // Act
    const errors = validateForm(data);

    // Assert
    expect(errors.tags).toBeDefined();
  });
});
