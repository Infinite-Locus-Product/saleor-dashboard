import { cacheValidationMessages } from "@dashboard/cacheManagement/messages";
import {
  type CacheField,
  type CacheFieldValues,
  type CacheValidationErrors,
} from "@dashboard/cacheManagement/types";
import { Box, Input, Select, Textarea } from "@saleor/macaw-ui-next";
import { useIntl } from "react-intl";

interface CachePayloadFormProps {
  fields: CacheField[];
  values: CacheFieldValues;
  errors: CacheValidationErrors;
  disabled?: boolean;
  onChange: (name: string, value: string) => void;
}

/**
 * Renders inputs from a field schema. Every endpoint that needs a payload gets
 * its form from here — no endpoint-specific JSX exists anywhere in the module.
 */
export const CachePayloadForm = ({
  fields,
  values,
  errors,
  disabled,
  onChange,
}: CachePayloadFormProps) => {
  const intl = useIntl();

  const getHelperText = (field: CacheField): string | undefined => {
    const errorCode = errors[field.name];

    if (errorCode) {
      return intl.formatMessage(cacheValidationMessages[errorCode]);
    }

    return field.helpText ? intl.formatMessage(field.helpText) : undefined;
  };

  return (
    <Box display="grid" gap={3}>
      {fields.map(field => {
        const label = intl.formatMessage(field.label);
        const hasError = Boolean(errors[field.name]);
        const helperText = getHelperText(field);
        const value = values[field.name] ?? "";

        if (field.type === "select") {
          return (
            <Select
              key={field.name}
              size="medium"
              width="100%"
              label={label}
              value={value}
              error={hasError}
              helperText={helperText}
              disabled={disabled}
              options={field.options.map(option => ({
                value: option.value,
                label: intl.formatMessage(option.label),
              }))}
              onChange={selected => onChange(field.name, String(selected))}
              data-test-id={`cache-field-${field.name}`}
            />
          );
        }

        if (field.type === "idList") {
          return (
            <Textarea
              key={field.name}
              rows={3}
              width="100%"
              label={label}
              value={value}
              error={hasError}
              helperText={helperText}
              disabled={disabled}
              placeholder={field.placeholder}
              onChange={event => onChange(field.name, event.target.value)}
              data-test-id={`cache-field-${field.name}`}
            />
          );
        }

        return (
          <Input
            key={field.name}
            size="medium"
            width="100%"
            label={label}
            value={value}
            error={hasError}
            helperText={helperText}
            disabled={disabled}
            placeholder={field.placeholder}
            onChange={event => onChange(field.name, event.target.value)}
            data-test-id={`cache-field-${field.name}`}
          />
        );
      })}
    </Box>
  );
};
