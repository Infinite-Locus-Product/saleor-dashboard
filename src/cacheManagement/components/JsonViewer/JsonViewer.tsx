import { cacheManagementMessages } from "@dashboard/cacheManagement/messages";
import { useClipboard } from "@dashboard/hooks/useClipboard";
import { Box, Button, Text } from "@saleor/macaw-ui-next";
import { Check, Copy } from "lucide-react";
import { useMemo } from "react";
import { useIntl } from "react-intl";

import styles from "./JsonViewer.module.css";

interface JsonViewerProps {
  label: string;
  value: unknown;
  copyLabel: string;
}

/** Renders a value as pretty JSON with a copy affordance. */
export const JsonViewer = ({ label, value, copyLabel }: JsonViewerProps) => {
  const intl = useIntl();
  const [copied, copy] = useClipboard();

  const serialized = useMemo(() => {
    if (value === null || value === undefined) return "null";

    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }, [value]);

  return (
    <Box display="flex" flexDirection="column" gap={1.5}>
      <Box display="flex" alignItems="center" justifyContent="space-between" gap={2}>
        <Text size={2} fontWeight="medium" color="default2">
          {label}
        </Text>
        <Button
          type="button"
          variant="tertiary"
          size="small"
          icon={copied ? <Check size={14} /> : <Copy size={14} />}
          onClick={() => copy(serialized)}
        >
          {copied ? intl.formatMessage(cacheManagementMessages.copied) : copyLabel}
        </Button>
      </Box>
      <pre className={styles.viewer}>{serialized}</pre>
    </Box>
  );
};
