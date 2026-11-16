/**
 * TTXY-4841 L12 — optional axe-core check. @axe-core/playwright is not a
 * dependency of this repo yet; the module name is kept in a variable so the
 * specs type-check without it, and the L12 tests skip with this reason until
 * it is installed (pnpm add -D @axe-core/playwright).
 */
import { type Page } from "@playwright/test";

export const AXE_MISSING_REASON =
  "@axe-core/playwright is not installed in saleor-dashboard; add it as a devDependency to run the L12 accessibility checks";

const AXE_MODULE = "@axe-core/playwright";

interface AxeViolation {
  id: string;
  impact?: string | null;
  nodes: unknown[];
}

interface AxeBuilderLike {
  include: (selector: string) => AxeBuilderLike;
  withTags: (tags: string[]) => AxeBuilderLike;
  analyze: () => Promise<{ violations: AxeViolation[] }>;
}

type AxeBuilderCtor = new (options: { page: Page }) => AxeBuilderLike;

export const loadAxeBuilder = async (): Promise<AxeBuilderCtor | null> => {
  try {
    const mod = await import(/* @vite-ignore */ AXE_MODULE);

    return (mod.default ?? mod.AxeBuilder ?? null) as AxeBuilderCtor | null;
  } catch {
    return null;
  }
};

/** Serious/critical WCAG A/AA violations inside `selector`. */
export const seriousViolations = async (
  AxeBuilder: AxeBuilderCtor,
  page: Page,
  selector: string,
): Promise<AxeViolation[]> => {
  const result = await new AxeBuilder({ page })
    .include(selector)
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();

  return result.violations.filter(
    violation => violation.impact === "serious" || violation.impact === "critical",
  );
};
