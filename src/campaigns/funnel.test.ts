// TTXY-4841 — funnel rows: messaged vs holdout with conversion per stage (L9),
// untracked stages as null, never 0 (L10).
import { FUNNEL_STAGES } from "@dashboard/cohorts/types";

import { campaignFunnelFixture } from "./fixtures";
import { buildFunnelRows } from "./funnel";

describe("buildFunnelRows", () => {
  it("L9 — one row per stage, in order, with both groups' counts", () => {
    // Arrange / Act
    const rows = buildFunnelRows(campaignFunnelFixture());

    // Assert
    expect(rows.map(row => row.stage)).toEqual([...FUNNEL_STAGES]);
    expect(rows[0]).toMatchObject({
      stage: "tagged",
      messaged: { count: 900 },
      holdout: { count: 100 },
    });
  });

  it("L9 — conversion is from the previous tracked stage of the same group", () => {
    // Arrange / Act
    const rows = buildFunnelRows(campaignFunnelFixture());
    const byStage = Object.fromEntries(rows.map(row => [row.stage, row]));

    // Assert — sent 880 / tagged 900
    expect(byStage.sent.messaged.conversion).toBeCloseTo(880 / 900);
    // clicked 120 / sent 880 (delivered is not tracked, so it is skipped)
    expect(byStage.clicked.messaged.conversion).toBeCloseTo(120 / 880);
    // holdout added_to_cart 4 / tagged 100 (sent, delivered, clicked are null)
    expect(byStage.added_to_cart.holdout.conversion).toBeCloseTo(4 / 100);
    // the first stage has no previous stage
    expect(byStage.tagged.messaged.conversion).toBeNull();
  });

  it("L10 — null stages and stages flagged untracked stay null (not 0)", () => {
    // Arrange
    const funnel = campaignFunnelFixture({ tracked: { delivered: false, clicked: false } });

    // Act
    const byStage = Object.fromEntries(buildFunnelRows(funnel).map(row => [row.stage, row]));

    // Assert
    expect(byStage.delivered.messaged).toEqual({ count: null, conversion: null });
    expect(byStage.clicked.messaged).toEqual({ count: null, conversion: null });
    expect(byStage.sent.holdout).toEqual({ count: null, conversion: null });
    // added_to_cart now converts from sent, the last tracked stage
    expect(byStage.added_to_cart.messaged.conversion).toBeCloseTo(60 / 880);
  });

  it("L9 — a zero previous count gives a null conversion, not a division by zero", () => {
    // Arrange
    const funnel = campaignFunnelFixture();

    funnel.groups.holdout.stages.order_placed = 0;

    // Act
    const byStage = Object.fromEntries(buildFunnelRows(funnel).map(row => [row.stage, row]));

    // Assert
    expect(byStage.repeat_order.holdout.conversion).toBeNull();
  });
});
