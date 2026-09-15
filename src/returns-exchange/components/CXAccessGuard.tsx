import { useUser } from "@dashboard/auth/useUser";
import { Box, Skeleton, Text } from "@saleor/macaw-ui-next";
import { ShieldAlert } from "lucide-react";
import { type ReactNode } from "react";

import { useCXPermission } from "../hooks/useCXPermission";

interface CXAccessGuardProps {
  children: ReactNode;
  featureName?: string;
}

/**
 * Route-level gate for CX views. The sidebar already hides the section from
 * non-CX users; this covers direct URLs.
 */
export const CXAccessGuard = ({ children, featureName = "Manual Returns" }: CXAccessGuardProps) => {
  const { user } = useUser();
  const hasAccess = useCXPermission();

  // `user` is undefined until the user-details query resolves, null when signed out.
  if (user === undefined) {
    return (
      <Box padding={6} data-test-id="cx-access-guard-loading" aria-busy="true">
        <Skeleton __height={200} />
      </Box>
    );
  }

  if (!hasAccess) {
    return (
      <Box padding={6} data-test-id="cx-access-denied">
        <Box display="flex" alignItems="center" gap={3} marginBottom={2}>
          <ShieldAlert size={20} aria-hidden="true" />
          <Text as="h1" size={7} fontWeight="bold">
            {`You don't have access to ${featureName}`}
          </Text>
        </Box>
        <Text size={3} color="default2">
          Ask an admin to add you to the &quot;CX Returns Management&quot; permission group.
        </Text>
      </Box>
    );
  }

  return <>{children}</>;
};
