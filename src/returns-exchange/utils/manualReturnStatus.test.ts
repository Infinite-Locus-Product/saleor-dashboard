import {
  ERP_SYNC_FILTER_OPTIONS,
  erpSyncLabel,
  isValidEmail,
  isValidUpi,
  OVERRIDE_NOTE_MAX,
  OVERRIDE_NOTE_MIN,
  overrideReasonLabel,
  RETURN_STATUS_FILTER_OPTIONS,
  returnStatusLabel,
} from "./manualReturnStatus";

describe("manualReturnStatus", () => {
  describe("returnStatusLabel", () => {
    it.each([
      ["RETURN_APPROVED", "Return Approved"],
      ["RETURN_SCHEDULED", "Pickup Scheduled"],
      ["RETURN_PICKED_UP", "Return Picked Up"],
      ["RETURN_COMPLETED", "Return Completed"],
      ["RETURN_CANCELLED", "Return Cancelled"],
      ["REFUND_INITIATED", "Refund Initiated"],
      ["REFUND_IN_PROCESS", "Refund Processing"],
      ["REFUND_PROCESSING", "Refund Processing"],
      ["REFUND_COMPLETED", "Refund Completed"],
      ["REFUND_FAILED", "Refund Failed"],
      ["RTO_INITIATED", "Return To Origin"],
    ])("maps %s to %s", (status, label) => {
      // Arrange / Act
      const result = returnStatusLabel(status);

      // Assert
      expect(result).toBe(label);
    });

    it("humanizes unknown statuses", () => {
      // Arrange / Act
      const result = returnStatusLabel("RETURN_QC_PENDING");

      // Assert
      expect(result).toBe("Return Qc Pending");
    });

    it("returns a dash for missing statuses", () => {
      // Arrange / Act / Assert
      expect(returnStatusLabel(null)).toBe("—");
      expect(returnStatusLabel("")).toBe("—");
    });
  });

  describe("filter options", () => {
    it("status filter starts with 'All statuses' and covers every status the backend writes, once", () => {
      // Arrange
      const values = RETURN_STATUS_FILTER_OPTIONS.map(o => o.value);

      // Assert
      expect(RETURN_STATUS_FILTER_OPTIONS[0]).toEqual({ value: "", label: "All statuses" });
      expect(values.slice(1).sort()).toEqual(
        [
          "RETURN_APPROVED",
          "RETURN_SCHEDULED",
          "RETURN_PICKED_UP",
          "RETURN_COMPLETED",
          "RETURN_CANCELLED",
          "REFUND_INITIATED",
          "REFUND_IN_PROCESS",
          "REFUND_COMPLETED",
          "REFUND_FAILED",
          "RTO_INITIATED",
        ].sort(),
      );
      expect(RETURN_STATUS_FILTER_OPTIONS).toContainEqual({
        value: "REFUND_IN_PROCESS",
        label: "Refund Processing",
      });
      expect(new Set(values).size).toBe(values.length);
      expect(new Set(RETURN_STATUS_FILTER_OPTIONS.map(o => o.label)).size).toBe(values.length);
    });

    it("ERP sync filter offers all, pending, synced and failed", () => {
      // Assert
      expect(ERP_SYNC_FILTER_OPTIONS.map(o => o.value)).toEqual([
        "",
        "PENDING",
        "SUCCESS",
        "FAILED",
      ]);
    });

    it("labels ERP sync statuses", () => {
      // Assert
      expect(erpSyncLabel("PENDING")).toBe("Pending");
      expect(erpSyncLabel("SUCCESS")).toBe("Synced");
      expect(erpSyncLabel("FAILED")).toBe("Failed");
    });
  });

  describe("overrideReasonLabel", () => {
    it.each([
      ["window_exceeded", "Return window exceeded"],
      ["not_returnable", "Product not returnable"],
      ["cant_return_flag", "Return blocked flag set"],
    ])("maps %s to %s", (reason, label) => {
      // Assert
      expect(overrideReasonLabel(reason)).toBe(label);
    });
  });

  describe("validators", () => {
    it.each(["asha@example.com", "a.b+c@shop.co.in"])("accepts email %s", email => {
      // Assert
      expect(isValidEmail(email)).toBe(true);
    });

    it.each(["", "asha", "asha@", "asha@example", "as ha@example.com"])(
      "rejects email '%s'",
      email => {
        // Assert
        expect(isValidEmail(email)).toBe(false);
      },
    );

    it.each(["asha@okaxis", "asha.rao-1_x@ybl", "9876543210@upi"])("accepts UPI %s", upi => {
      // Assert
      expect(isValidUpi(upi)).toBe(true);
    });

    it.each(["", "a@okaxis", "asha@o", "asha@ok1", "asha@@okaxis", "asha okaxis", "asha@ok axis"])(
      "rejects UPI '%s'",
      upi => {
        // Assert
        expect(isValidUpi(upi)).toBe(false);
      },
    );

    it("exposes the override note length limits", () => {
      // Assert
      expect(OVERRIDE_NOTE_MIN).toBe(15);
      expect(OVERRIDE_NOTE_MAX).toBe(1000);
    });
  });
});
