/**
 * Dynamic-cohort rule builder (TTXY-4841, L2–L4).
 *
 * Controlled: the parent owns the editor tree (ruleModel.EditorGroup) and gets
 * every change back through `onChange`. Fields and operators come only from the
 * `fields` catalog (GET /cohorts/rule-fields); the value control is chosen by
 * the field's type. Client errors (`errors`) and server `invalid_rule` errors
 * (`serverErrors`, already mapped to node keys) are shown on the node they
 * belong to.
 */
import { type RuleFieldDefinition, type RuleLogic } from "@dashboard/cohorts/types";
import { Box, Button, Input, Text } from "@saleor/macaw-ui-next";
import { Plus, Trash2 } from "lucide-react";
import { useCallback, useId } from "react";
import { useIntl } from "react-intl";

import { fieldLabel, operatorLabel, ruleBuilderMessages, ruleErrorMessages } from "./messages";
import styles from "./RuleBuilder.module.css";
import { RuleCategoryPicker, RuleProductPicker } from "./RuleEntityPicker";
import {
  addChild,
  BETWEEN,
  type ConditionPatch,
  countConditions,
  type EditorCondition,
  type EditorGroup,
  emptyGroup,
  findField,
  MAX_CONDITIONS,
  MAX_DEPTH,
  MAX_ITEMS,
  MAX_TEXT_LENGTH,
  newCondition,
  removeNode,
  type RuleClientError,
  type RuleServerErrors,
  type RuleValidationErrors,
  updateCondition,
  updateGroupLogic,
} from "./ruleModel";

export interface RuleBuilderProps {
  value: EditorGroup;
  fields: RuleFieldDefinition[];
  onChange: (next: EditorGroup) => void;
  errors?: RuleValidationErrors;
  serverErrors?: RuleServerErrors;
  disabled?: boolean;
}

interface Handlers {
  fields: RuleFieldDefinition[];
  errors: RuleValidationErrors;
  serverErrors: RuleServerErrors;
  disabled: boolean;
  atConditionLimit: boolean;
  onAddCondition: (groupKey: string) => void;
  onAddGroup: (groupKey: string) => void;
  onRemove: (key: string) => void;
  onLogic: (groupKey: string, logic: RuleLogic) => void;
  onCondition: (key: string, patch: ConditionPatch) => void;
}

const NodeErrors = ({
  clientError,
  serverMessages,
}: {
  clientError?: RuleClientError;
  serverMessages?: string[];
}) => {
  const intl = useIntl();

  if (!clientError && !serverMessages?.length) return null;

  return (
    <Box display="grid" gap={1} data-test-id="rule-error" role="alert">
      {clientError && (
        <Text size={2} color="critical1">
          {intl.formatMessage(ruleErrorMessages[clientError], {
            max:
              clientError === "too_long"
                ? MAX_TEXT_LENGTH
                : clientError === "too_many_items"
                  ? MAX_ITEMS
                  : MAX_CONDITIONS,
          })}
        </Text>
      )}
      {serverMessages?.map(message => (
        <Text key={message} size={2} color="critical1">
          {message}
        </Text>
      ))}
    </Box>
  );
};

const ConditionValue = ({
  condition,
  handlers,
  invalid,
}: {
  condition: EditorCondition;
  handlers: Handlers;
  invalid: boolean;
}) => {
  const intl = useIntl();
  const type = findField(handlers.fields, condition.field)?.type;
  const patch = (next: ConditionPatch) => handlers.onCondition(condition.key, next);

  if (type === "product" || type === "category") {
    const Picker = type === "product" ? RuleProductPicker : RuleCategoryPicker;

    return (
      <Picker
        value={condition.options}
        onChange={options => patch({ options })}
        disabled={handlers.disabled}
        error={invalid}
      />
    );
  }

  if (type === "number" && condition.operator === BETWEEN) {
    return (
      <Box display="grid" gridTemplateColumns={2} gap={2}>
        <Input
          size="small"
          label={intl.formatMessage(ruleBuilderMessages.minLabel)}
          inputMode="decimal"
          value={condition.min}
          error={invalid}
          disabled={handlers.disabled}
          onChange={event => patch({ min: event.target.value })}
          data-test-id="rule-min"
        />
        <Input
          size="small"
          label={intl.formatMessage(ruleBuilderMessages.maxLabel)}
          inputMode="decimal"
          value={condition.max}
          error={invalid}
          disabled={handlers.disabled}
          onChange={event => patch({ max: event.target.value })}
          data-test-id="rule-max"
        />
      </Box>
    );
  }

  return (
    <Input
      size="small"
      label={intl.formatMessage(ruleBuilderMessages.valueLabel)}
      // Text, not type=number: a typed letter must stay visible so the
      // "Enter a number" error can explain it (L3).
      inputMode={type === "number" ? "decimal" : "text"}
      maxLength={type === "number" ? undefined : MAX_TEXT_LENGTH}
      value={condition.text}
      error={invalid}
      disabled={handlers.disabled}
      onChange={event => patch({ text: event.target.value })}
      data-test-id="rule-value"
    />
  );
};

const ConditionRow = ({
  condition,
  handlers,
}: {
  condition: EditorCondition;
  handlers: Handlers;
}) => {
  const intl = useIntl();
  const definition = findField(handlers.fields, condition.field);
  const clientError = handlers.errors[condition.key];
  const serverMessages = handlers.serverErrors[condition.key];
  const invalid = !!clientError || !!serverMessages?.length;
  // A saved field that left the catalog stays visible (and flagged) until changed.
  const fieldOptions = definition
    ? handlers.fields
    : [{ field: condition.field, type: "text" as const, operators: [] }, ...handlers.fields];
  const operators = definition?.operators ?? [condition.operator];

  return (
    <Box display="grid" gap={1} data-test-id="rule-condition">
      <Box className={styles.row}>
        <select
          className={styles.select}
          aria-label={intl.formatMessage(ruleBuilderMessages.fieldLabel)}
          aria-invalid={clientError === "unknown_field"}
          value={condition.field}
          disabled={handlers.disabled}
          onChange={event => handlers.onCondition(condition.key, { field: event.target.value })}
          data-test-id="rule-field"
        >
          {fieldOptions.map(option => (
            <option key={option.field} value={option.field}>
              {fieldLabel(intl, option.field)}
            </option>
          ))}
        </select>
        <select
          className={styles.select}
          aria-label={intl.formatMessage(ruleBuilderMessages.operatorLabel)}
          aria-invalid={clientError === "unknown_operator"}
          value={condition.operator}
          disabled={handlers.disabled}
          onChange={event => handlers.onCondition(condition.key, { operator: event.target.value })}
          data-test-id="rule-operator"
        >
          {operators.map(operator => (
            <option key={operator} value={operator}>
              {operatorLabel(intl, operator)}
            </option>
          ))}
        </select>
        <ConditionValue condition={condition} handlers={handlers} invalid={invalid} />
        <Button
          type="button"
          variant="tertiary"
          icon={<Trash2 size={16} />}
          aria-label={intl.formatMessage(ruleBuilderMessages.removeCondition)}
          title={intl.formatMessage(ruleBuilderMessages.removeCondition)}
          disabled={handlers.disabled}
          onClick={() => handlers.onRemove(condition.key)}
          data-test-id="rule-remove"
        />
      </Box>
      <NodeErrors clientError={clientError} serverMessages={serverMessages} />
    </Box>
  );
};

const GroupEditor = ({
  group,
  depth,
  handlers,
}: {
  group: EditorGroup;
  depth: number;
  handlers: Handlers;
}) => {
  const intl = useIntl();
  const logicId = useId();
  const isRoot = depth === 1;

  return (
    <Box
      className={isRoot ? styles.group : `${styles.group} ${styles.nested}`}
      data-test-id="rule-group"
    >
      <Box display="flex" gap={2} alignItems="center">
        <label htmlFor={logicId}>
          <Text size={2} color="default2">
            {intl.formatMessage(ruleBuilderMessages.logicLabel)}
          </Text>
        </label>
        <select
          id={logicId}
          className={styles.select}
          value={group.logic}
          disabled={handlers.disabled}
          onChange={event => handlers.onLogic(group.key, event.target.value as RuleLogic)}
          data-test-id="rule-logic"
        >
          <option value="AND">{intl.formatMessage(ruleBuilderMessages.logicAnd)}</option>
          <option value="OR">{intl.formatMessage(ruleBuilderMessages.logicOr)}</option>
        </select>
      </Box>

      {group.children.map(node =>
        node.kind === "group" ? (
          <GroupEditor key={node.key} group={node} depth={depth + 1} handlers={handlers} />
        ) : (
          <ConditionRow key={node.key} condition={node} handlers={handlers} />
        ),
      )}

      <NodeErrors
        clientError={handlers.errors[group.key]}
        serverMessages={handlers.serverErrors[group.key]}
      />

      <Box display="flex" gap={2} flexWrap="wrap">
        <Button
          type="button"
          variant="secondary"
          size="small"
          disabled={handlers.disabled || handlers.atConditionLimit}
          onClick={() => handlers.onAddCondition(group.key)}
          data-test-id="rule-add-condition"
        >
          <Plus size={14} />
          {intl.formatMessage(ruleBuilderMessages.addCondition)}
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="small"
          disabled={handlers.disabled || handlers.atConditionLimit || depth >= MAX_DEPTH}
          onClick={() => handlers.onAddGroup(group.key)}
          data-test-id="rule-add-group"
        >
          <Plus size={14} />
          {intl.formatMessage(ruleBuilderMessages.addGroup)}
        </Button>
        {!isRoot && (
          <Button
            type="button"
            variant="tertiary"
            size="small"
            disabled={handlers.disabled}
            onClick={() => handlers.onRemove(group.key)}
            data-test-id="rule-remove-group"
          >
            <Trash2 size={14} />
            {intl.formatMessage(ruleBuilderMessages.removeGroup)}
          </Button>
        )}
      </Box>
    </Box>
  );
};

export const RuleBuilder = ({
  value,
  fields,
  onChange,
  errors = {},
  serverErrors = {},
  disabled = false,
}: RuleBuilderProps) => {
  const intl = useIntl();
  const total = countConditions(value);

  const onAddCondition = useCallback(
    (groupKey: string) => onChange(addChild(value, groupKey, newCondition(fields))),
    [value, fields, onChange],
  );
  // A new group starts with one condition, since an empty group cannot be saved.
  const onAddGroup = useCallback(
    (groupKey: string) =>
      onChange(addChild(value, groupKey, { ...emptyGroup(), children: [newCondition(fields)] })),
    [value, fields, onChange],
  );
  const onRemove = useCallback(
    (key: string) => onChange(removeNode(value, key)),
    [value, onChange],
  );
  const onLogic = useCallback(
    (groupKey: string, logic: RuleLogic) => onChange(updateGroupLogic(value, groupKey, logic)),
    [value, onChange],
  );
  const onCondition = useCallback(
    (key: string, patch: ConditionPatch) => onChange(updateCondition(value, key, patch, fields)),
    [value, fields, onChange],
  );

  const handlers: Handlers = {
    fields,
    errors,
    serverErrors,
    disabled: disabled || fields.length === 0,
    atConditionLimit: total >= MAX_CONDITIONS,
    onAddCondition,
    onAddGroup,
    onRemove,
    onLogic,
    onCondition,
  };

  return (
    <Box display="grid" gap={3} data-test-id="rule-builder">
      <GroupEditor group={value} depth={1} handlers={handlers} />
      <Text size={2} color="default2">
        {intl.formatMessage(ruleBuilderMessages.limits, {
          count: total,
          max: MAX_CONDITIONS,
          depth: MAX_DEPTH,
        })}
      </Text>
    </Box>
  );
};
