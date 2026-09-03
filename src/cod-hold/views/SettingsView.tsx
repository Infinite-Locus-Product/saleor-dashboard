import { Box, Button, Input, Text } from "@saleor/macaw-ui-next";
import type { ChangeEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  addAlertEmail,
  addListValue,
  type CodHoldListName,
  fetchList,
  fetchSettings,
  removeAlertEmail,
  removeListValue,
  saveSettings,
  uploadListCsv,
} from "../api/codHoldApi";
import { type CodHoldListItem, type CodHoldSettings } from "../types";

export const SettingsView = () => {
  const [settings, setSettings] = useState<CodHoldSettings | null>(null);
  const [thresholds, setThresholds] = useState({
    slaOnTrackHours: "",
    slaDelayedHours: "",
    slaBreachedHours: "",
  });
  const [savingThresholds, setSavingThresholds] = useState(false);
  const [thresholdsError, setThresholdsError] = useState<string | null>(null);
  const [thresholdsSaved, setThresholdsSaved] = useState(false);

  const loadSettings = useCallback(async () => {
    const result = await fetchSettings();

    setSettings(result);
    setThresholds({
      slaOnTrackHours: String(result.slaOnTrackHours),
      slaDelayedHours: String(result.slaDelayedHours),
      slaBreachedHours: String(result.slaBreachedHours),
    });
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleSaveThresholds = async () => {
    setSavingThresholds(true);
    setThresholdsError(null);
    setThresholdsSaved(false);

    try {
      const updated = await saveSettings({
        slaOnTrackHours: Number(thresholds.slaOnTrackHours),
        slaDelayedHours: Number(thresholds.slaDelayedHours),
        slaBreachedHours: Number(thresholds.slaBreachedHours),
      });

      setSettings(updated);
      setThresholdsSaved(true);
    } catch (err: any) {
      setThresholdsError(err.message);
    } finally {
      setSavingThresholds(false);
    }
  };

  return (
    <Box padding={6} display="flex" flexDirection="column" gap={6}>
      <Text size={8} fontWeight="bold">
        COD Hold Settings
      </Text>

      {/* SLA thresholds */}
      <Box borderWidth={1} borderStyle="solid" borderColor="default1" borderRadius={3} padding={4}>
        <Text size={5} fontWeight="bold" display="block" marginBottom={3}>
          SLA Thresholds
        </Text>
        <Text size={3} color="default2" display="block" marginBottom={3}>
          An order past the BREACHED threshold is also auto-released to the ERP as a normal COD
          order if no agent has acted on it.
        </Text>
        <Box display="flex" gap={3} alignItems="flex-end" flexWrap="wrap">
          <Box __minWidth="140px">
            <Input
              type="number"
              label="On track (hours)"
              value={thresholds.slaOnTrackHours}
              onChange={e => setThresholds({ ...thresholds, slaOnTrackHours: e.target.value })}
            />
          </Box>
          <Box __minWidth="140px">
            <Input
              type="number"
              label="Delayed (hours)"
              value={thresholds.slaDelayedHours}
              onChange={e => setThresholds({ ...thresholds, slaDelayedHours: e.target.value })}
            />
          </Box>
          <Box __minWidth="140px">
            <Input
              type="number"
              label="Breached / auto-release (hours)"
              value={thresholds.slaBreachedHours}
              onChange={e => setThresholds({ ...thresholds, slaBreachedHours: e.target.value })}
            />
          </Box>
          <Button
            variant="primary"
            size="small"
            onClick={handleSaveThresholds}
            disabled={savingThresholds}
          >
            {savingThresholds ? "Saving…" : "Save"}
          </Button>
        </Box>
        {thresholdsError && (
          <Text size={2} color="critical1" display="block" marginTop={2}>
            {thresholdsError}
          </Text>
        )}
        {thresholdsSaved && !thresholdsError && (
          <Text size={2} color="success1" display="block" marginTop={2}>
            Saved.
          </Text>
        )}
      </Box>

      <EditableList
        title="Hold Pincodes"
        description="COD orders shipping to one of these pincodes are held for review."
        list="pincodes"
        placeholder="110001"
      />

      <EditableList
        title="Hold Phone Numbers"
        description="COD orders with one of these shipping phone numbers are held for review."
        list="phones"
        placeholder="9876543210"
      />

      <EditableList
        title="Round-Robin Agents"
        description="Held orders are assigned to these agents in rotation, as a signal — any agent with dashboard access can still act on any order."
        list="agents"
        placeholder="agent@example.com"
      />

      <AlertEmailsSection settings={settings} onChanged={loadSettings} />
    </Box>
  );
};

interface EditableListProps {
  title: string;
  description: string;
  list: CodHoldListName;
  placeholder: string;
}

const EditableList = ({ title, description, list, placeholder }: EditableListProps) => {
  const [items, setItems] = useState<CodHoldListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newValue, setNewValue] = useState("");
  const [uploadErrors, setUploadErrors] = useState<{ row: number; message: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setItems(await fetchList(list));
    setLoading(false);
  }, [list]);

  useEffect(() => {
    load();
  }, [load]);

  const handleAdd = async () => {
    if (!newValue.trim()) return;

    await addListValue(list, newValue.trim());
    setNewValue("");
    await load();
  };

  const handleRemove = async (value: string) => {
    await removeListValue(list, value);
    await load();
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];

    if (!file) return;

    setUploading(true);
    setUploadErrors([]);

    try {
      const result = await uploadListCsv(list, file);

      setUploadErrors(result.errors);
      await load();
    } finally {
      setUploading(false);

      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <Box borderWidth={1} borderStyle="solid" borderColor="default1" borderRadius={3} padding={4}>
      <Text size={5} fontWeight="bold" display="block" marginBottom={1}>
        {title}
      </Text>
      <Text size={3} color="default2" display="block" marginBottom={3}>
        {description}
      </Text>

      <Box display="flex" gap={2} marginBottom={3} alignItems="flex-end">
        <Box __minWidth="220px">
          <Input
            label={placeholder}
            value={newValue}
            onChange={e => setNewValue(e.target.value)}
            size="small"
          />
        </Box>
        <Button variant="secondary" size="small" onClick={handleAdd}>
          Add
        </Button>
        <Box __marginLeft="auto">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            disabled={uploading}
          />
        </Box>
      </Box>

      {uploadErrors.length > 0 && (
        <Box marginBottom={3}>
          {uploadErrors.map(e => (
            <Text key={e.row} size={2} color="critical1" display="block">
              Row {e.row}: {e.message}
            </Text>
          ))}
        </Box>
      )}

      {loading ? (
        <Text size={3} color="default2">
          Loading…
        </Text>
      ) : items.length === 0 ? (
        <Text size={3} color="default2">
          None configured yet.
        </Text>
      ) : (
        <Box display="flex" flexDirection="column" gap={1} __maxHeight="240px" __overflowY="auto">
          {items.map(item => (
            <Box
              key={item.id}
              display="flex"
              justifyContent="space-between"
              alignItems="center"
              paddingY={1}
            >
              <Text size={3}>{item.value}</Text>
              <Button variant="tertiary" size="small" onClick={() => handleRemove(item.value)}>
                Remove
              </Button>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
};

interface AlertEmailsSectionProps {
  settings: CodHoldSettings | null;
  onChanged: () => void;
}

const AlertEmailsSection = ({ settings, onChanged }: AlertEmailsSectionProps) => {
  const [newEmail, setNewEmail] = useState("");

  const handleAdd = async () => {
    if (!newEmail.trim()) return;

    await addAlertEmail(newEmail.trim());
    setNewEmail("");
    onChanged();
  };

  const handleRemove = async (email: string) => {
    await removeAlertEmail(email);
    onChanged();
  };

  return (
    <Box borderWidth={1} borderStyle="solid" borderColor="default1" borderRadius={3} padding={4}>
      <Text size={5} fontWeight="bold" display="block" marginBottom={1}>
        Ops Alert Recipients
      </Text>
      <Text size={3} color="default2" display="block" marginBottom={3}>
        Emailed when the ERP forward fails repeatedly, a message lands in the dead-letter queue, or
        the webhook signature verification keeps failing.
      </Text>

      <Box display="flex" gap={2} marginBottom={3} alignItems="flex-end">
        <Box __minWidth="220px">
          <Input
            label="ops@example.com"
            value={newEmail}
            onChange={e => setNewEmail(e.target.value)}
            size="small"
          />
        </Box>
        <Button variant="secondary" size="small" onClick={handleAdd}>
          Add
        </Button>
      </Box>

      {!settings || settings.alertRecipients.length === 0 ? (
        <Text size={3} color="default2">
          None configured yet.
        </Text>
      ) : (
        <Box display="flex" flexDirection="column" gap={1}>
          {settings.alertRecipients.map(email => (
            <Box
              key={email}
              display="flex"
              justifyContent="space-between"
              alignItems="center"
              paddingY={1}
            >
              <Text size={3}>{email}</Text>
              <Button variant="tertiary" size="small" onClick={() => handleRemove(email)}>
                Remove
              </Button>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
};
