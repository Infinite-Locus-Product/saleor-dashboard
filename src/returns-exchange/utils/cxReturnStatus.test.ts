import { type CXReturnStatus } from "../types";
import {
  CX_CLOSED_STATUSES,
  isClosedStatus,
  isValidPincode,
  REJECTION_REASON_MAX,
  REJECTION_REASON_MIN,
} from "./cxReturnStatus";

describe("cxReturnStatus utils (TTXY-6032)", () => {
  it("J1 CX_CLOSED_STATUSES is exactly APPROVED, AUTO_APPROVED, EXCHANGED, RETURN_REJECTED", () => {
    // Assert
    expect([...CX_CLOSED_STATUSES].sort()).toEqual(
      ["APPROVED", "AUTO_APPROVED", "EXCHANGED", "RETURN_REJECTED"].sort(),
    );
  });

  it.each<[CXReturnStatus, boolean]>([
    ["RETURN_PENDING", false],
    ["CX_REVIEW", false],
    ["CX_ACTION", false],
    ["APPROVED", true],
    ["AUTO_APPROVED", true],
    ["EXCHANGED", true],
    ["RETURN_REJECTED", true],
  ])("J1 isClosedStatus(%s) is %s", (status, expected) => {
    // Act & Assert
    expect(isClosedStatus(status)).toBe(expected);
  });

  it("J1 isClosedStatus is false for null/undefined/unknown", () => {
    expect(isClosedStatus(undefined as unknown as CXReturnStatus)).toBe(false);
    expect(isClosedStatus(null as unknown as CXReturnStatus)).toBe(false);
    expect(isClosedStatus("SOMETHING_ELSE" as CXReturnStatus)).toBe(false);
  });

  it("J1 rejection reason bounds are 10..500", () => {
    expect(REJECTION_REASON_MIN).toBe(10);
    expect(REJECTION_REASON_MAX).toBe(500);
  });

  it.each<[string, boolean]>([
    ["560001", true],
    [" 560001 ", true],
    ["56000", false],
    ["5600011", false],
    ["56000a", false],
    ["", false],
    ["      ", false],
    ["56 001", false],
  ])("J6 isValidPincode(%p) is %s", (value, expected) => {
    expect(isValidPincode(value)).toBe(expected);
  });
});
