import { defineMessages, type IntlShape, type MessageDescriptor } from "react-intl";

import { type RuleClientError } from "./ruleModel";

// User-facing copy for the dynamic-cohort rule builder (TTXY-4841).
export const ruleBuilderMessages = defineMessages({
  cardTitle: {
    defaultMessage: "Rules",
    id: "hZJa4e",
    description: "dynamic cohort rule builder card title",
  },
  cardHelp: {
    defaultMessage:
      "Customers who match these rules join the cohort on the next sync and leave it once they stop matching.",
    id: "b0W2AC",
    description: "dynamic cohort rule builder card help text",
  },
  logicLabel: {
    defaultMessage: "Match",
    id: "aPxna7",
    description: "rule group AND/OR selector label",
  },
  logicAnd: {
    defaultMessage: "All of these (AND)",
    id: "8lCpJx",
    description: "rule group logic option AND",
  },
  logicOr: {
    defaultMessage: "Any of these (OR)",
    id: "tyJrJ5",
    description: "rule group logic option OR",
  },
  addCondition: {
    defaultMessage: "Add condition",
    id: "RK1HBl",
    description: "rule builder button adding a condition to a group",
  },
  addGroup: {
    defaultMessage: "Add group",
    id: "nRk7sC",
    description: "rule builder button adding a nested group",
  },
  removeCondition: {
    defaultMessage: "Remove condition",
    id: "6nFduz",
    description: "rule builder button removing a condition",
  },
  removeGroup: {
    defaultMessage: "Remove group",
    id: "KTGVm0",
    description: "rule builder button removing a nested group",
  },
  fieldLabel: {
    defaultMessage: "Field",
    id: "OsJJ0V",
    description: "rule condition field selector label",
  },
  operatorLabel: {
    defaultMessage: "Operator",
    id: "0DnopT",
    description: "rule condition operator selector label",
  },
  valueLabel: {
    defaultMessage: "Value",
    id: "LViOx7",
    description: "rule condition value input label",
  },
  minLabel: {
    defaultMessage: "Min",
    id: "TgJXKx",
    description: "rule condition between lower bound label",
  },
  maxLabel: {
    defaultMessage: "Max",
    id: "ARHncC",
    description: "rule condition between upper bound label",
  },
  productsLabel: {
    defaultMessage: "Products",
    id: "a/v5NC",
    description: "rule condition product picker label",
  },
  categoriesLabel: {
    defaultMessage: "Categories",
    id: "Hgk7I4",
    description: "rule condition category picker label",
  },
  noOptions: {
    defaultMessage: "No options to select",
    id: "7Me2/G",
    description: "rule condition picker, no search results",
  },
  limits: {
    defaultMessage: "{count} of {max} conditions · groups nest up to {depth} levels",
    id: "uWoS/U",
    description: "rule builder size and depth limits",
  },
  fieldsRetry: {
    defaultMessage: "Retry",
    id: "lt3Xup",
    description: "rule builder, retry loading the field catalog",
  },
  fieldsLoading: {
    defaultMessage: "Loading rule fields…",
    id: "ku1J8I",
    description: "rule builder while the field catalog loads",
  },
  fieldsError: {
    defaultMessage: "Couldn't load the rule fields. Reload the page to try again.",
    id: "uJZUvY",
    description: "rule builder when the field catalog failed to load",
  },
  errorEmptyGroup: {
    defaultMessage: "Add at least one rule",
    id: "sch7bM",
    description: "rule builder error, a group has no conditions",
  },
  errorRequired: {
    defaultMessage: "Enter a value",
    id: "iq17iM",
    description: "rule condition error, value missing",
  },
  errorNotANumber: {
    defaultMessage: "Enter a number",
    id: "q70/1e",
    description: "rule condition error, numeric field has text",
  },
  errorMinGtMax: {
    defaultMessage: "Min must not be greater than max",
    id: "W6G940",
    description: "rule condition error, between bounds reversed",
  },
  errorTooLong: {
    defaultMessage: "Use at most {max} characters",
    id: "8bbgNv",
    description: "rule condition error, text too long",
  },
  errorTooManyItems: {
    defaultMessage: "Pick at most {max} items",
    id: "rFnpzT",
    description: "rule condition error, too many picked products or categories",
  },
  errorUnknownField: {
    defaultMessage: "This field is no longer available. Pick another field.",
    id: "rB3lF2",
    description: "rule condition error, saved field missing from the catalog",
  },
  errorUnknownOperator: {
    defaultMessage: "Pick an operator this field allows",
    id: "/e1WnP",
    description: "rule condition error, operator not allowed for the field",
  },
  errorTooManyConditions: {
    defaultMessage: "Use at most {max} conditions",
    id: "Yy9sUS",
    description: "rule builder error, too many conditions",
  },
});

// Display names for known catalog entries. The catalog itself (which fields
// exist, their types and operators) always comes from GET /cohorts/rule-fields;
// an unknown field or operator falls back to a readable form of its id.
const fieldLabels = defineMessages({
  city: { defaultMessage: "City", id: "bAAtsM", description: "cohort rule field: city" },
  delivery_address: {
    defaultMessage: "Delivery address",
    id: "HEJ35R",
    description: "cohort rule field: delivery address",
  },
  order_count: {
    defaultMessage: "Delivered orders",
    id: "pAEcSi",
    description: "cohort rule field: delivered order count",
  },
  gmv: {
    defaultMessage: "Delivered GMV",
    id: "Otd1+5",
    description: "cohort rule field: delivered GMV",
  },
  return_count: {
    defaultMessage: "Returns",
    id: "S4BiX3",
    description: "cohort rule field: return count",
  },
  transaction_count: {
    defaultMessage: "Prepaid transactions",
    id: "Jn6Bk/",
    description: "cohort rule field: transaction count",
  },
  product_purchased: {
    defaultMessage: "Product purchased",
    id: "E92Aqv",
    description: "cohort rule field: product purchased",
  },
  category_purchased: {
    defaultMessage: "Category purchased",
    id: "mrP2MI",
    description: "cohort rule field: category purchased",
  },
  category_returned: {
    defaultMessage: "Category returned",
    id: "RoAlBr",
    description: "cohort rule field: category returned",
  },
  category_excluded: {
    defaultMessage: "Never bought from category",
    id: "26shIK",
    description: "cohort rule field: category excluded",
  },
});

const operatorLabels = defineMessages({
  equals: { defaultMessage: "equals", id: "gbqnv8", description: "cohort rule operator: equals" },
  includes: {
    defaultMessage: "includes",
    id: "gr3zWm",
    description: "cohort rule operator: includes",
  },
  greater_than: {
    defaultMessage: "greater than",
    id: "DRO0Be",
    description: "cohort rule operator: greater than",
  },
  greater_than_or_equal: {
    defaultMessage: "at least",
    id: "WjIihM",
    description: "cohort rule operator: greater than or equal",
  },
  less_than: {
    defaultMessage: "less than",
    id: "zYhvrn",
    description: "cohort rule operator: less than",
  },
  less_than_or_equal: {
    defaultMessage: "at most",
    id: "DL0P1D",
    description: "cohort rule operator: less than or equal",
  },
  between: {
    defaultMessage: "between",
    id: "2Dqf7i",
    description: "cohort rule operator: between",
  },
});

const humanize = (id: string): string => {
  const text = id.replace(/_/g, " ").trim();

  return text ? text.charAt(0).toUpperCase() + text.slice(1) : id;
};

const lookup = (
  table: Record<string, MessageDescriptor>,
  intl: IntlShape,
  id: string,
): string | null =>
  Object.prototype.hasOwnProperty.call(table, id) ? intl.formatMessage(table[id]) : null;

export const fieldLabel = (intl: IntlShape, field: string): string =>
  lookup(fieldLabels, intl, field) ?? humanize(field);

export const operatorLabel = (intl: IntlShape, operator: string): string =>
  lookup(operatorLabels, intl, operator) ?? humanize(operator).toLowerCase();

export const ruleErrorMessages: Record<RuleClientError, MessageDescriptor> = {
  empty_group: ruleBuilderMessages.errorEmptyGroup,
  required: ruleBuilderMessages.errorRequired,
  not_a_number: ruleBuilderMessages.errorNotANumber,
  min_gt_max: ruleBuilderMessages.errorMinGtMax,
  too_long: ruleBuilderMessages.errorTooLong,
  too_many_items: ruleBuilderMessages.errorTooManyItems,
  unknown_field: ruleBuilderMessages.errorUnknownField,
  unknown_operator: ruleBuilderMessages.errorUnknownOperator,
  too_many_conditions: ruleBuilderMessages.errorTooManyConditions,
};
