import { Text } from "@saleor/macaw-ui-next";
import { render, screen, within } from "@testing-library/react";

import { type CXReturnStatus } from "../types";
import { StatusChip } from "./StatusChip";

const classesOf = (el: Element) => el.className.split(/\s+/).filter(Boolean);

describe("StatusChip (TTXY-6032)", () => {
  it('J2 renders "Rejected" for RETURN_REJECTED', () => {
    // Act
    render(<StatusChip status={"RETURN_REJECTED" as CXReturnStatus} />);

    // Assert
    expect(screen.getByText("Rejected")).toBeInTheDocument();
    expect(screen.queryByText("RETURN_REJECTED")).not.toBeInTheDocument();
  });

  it("J2 uses the critical1 colour for RETURN_REJECTED", () => {
    // Arrange: macaw-ui sprinkles map tokens to atomic classes. A reference Text with the
    // chip's size/weight but color="critical1" differs from a default1 chip only by the
    // colour class(es); the rejected chip must carry those.
    const { container: ref } = render(
      <Text size={2} color="critical1" fontWeight="bold">
        ref
      </Text>,
    );
    const { container: pending } = render(<StatusChip status="RETURN_PENDING" />);
    const { container: rejected } = render(
      <StatusChip status={"RETURN_REJECTED" as CXReturnStatus} />,
    );

    const pendingClasses = classesOf(within(pending).getByText("Pending"));
    const colourClasses = classesOf(within(ref).getByText("ref")).filter(
      c => !pendingClasses.includes(c),
    );

    // Assert
    expect(colourClasses.length).toBeGreaterThan(0);

    const rejectedClasses = classesOf(within(rejected).getByText("Rejected"));

    colourClasses.forEach(c => expect(rejectedClasses).toContain(c));
  });

  it("J2 (R) existing labels unchanged", () => {
    render(<StatusChip status="AUTO_APPROVED" />);
    expect(screen.getByText("Auto Approved")).toBeInTheDocument();
  });
});
