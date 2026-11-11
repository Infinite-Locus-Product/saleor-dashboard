/**
 * Product / category picker for a rule condition (TTXY-4841). Uses the
 * dashboard's own Saleor search hooks; picked ids go to the rule's `value`
 * and their names to `label`, so the saved rule reads back without a lookup.
 */
import { Multiselect } from "@dashboard/components/Combobox";
import { DEFAULT_INITIAL_SEARCH_DATA } from "@dashboard/config";
import { type CommonSearchOpts } from "@dashboard/hooks/makeTopLevelSearch/types";
import { getSearchFetchMoreProps } from "@dashboard/hooks/makeTopLevelSearch/utils";
import useCategorySearch from "@dashboard/searches/useCategorySearch";
import useProductSearch from "@dashboard/searches/useProductSearch";
import { type FetchMoreProps } from "@dashboard/types";
import { mapEdgesToItems } from "@dashboard/utils/maps";
import { type Option } from "@saleor/macaw-ui-next";
import { useIntl } from "react-intl";

import { ruleBuilderMessages } from "./messages";
import { type PickedOption } from "./ruleModel";

interface PickerProps {
  value: PickedOption[];
  onChange: (value: PickedOption[]) => void;
  disabled?: boolean;
  error?: boolean;
}

interface EntityMultiselectProps extends PickerProps {
  label: string;
  options: Option[];
  fetch: (query: string) => void;
  fetchMore: FetchMoreProps;
}

const toPicked = (options: unknown): PickedOption[] =>
  (Array.isArray(options) ? options : []).map((option: Option) => ({
    value: String(option.value),
    label: String(option.label),
  }));

const EntityMultiselect = ({
  label,
  value,
  onChange,
  options,
  fetch,
  fetchMore,
  disabled,
  error,
}: EntityMultiselectProps) => {
  const intl = useIntl();

  return (
    <Multiselect
      size="small"
      label={label}
      value={value}
      options={options}
      fetchOptions={fetch}
      fetchMore={fetchMore}
      alwaysFetchOnFocus
      disabled={disabled}
      error={error}
      onChange={event => onChange(toPicked(event.target.value))}
      data-test-id="rule-entity-picker"
    >
      <Multiselect.NoOptions size={3} padding={1}>
        {intl.formatMessage(ruleBuilderMessages.noOptions)}
      </Multiselect.NoOptions>
    </Multiselect>
  );
};

export const RuleProductPicker = (props: PickerProps) => {
  const intl = useIntl();
  const { search, loadMore, result } = useProductSearch({
    variables: DEFAULT_INITIAL_SEARCH_DATA,
  });
  const options = (mapEdgesToItems(result?.data?.search) ?? []).map(({ id, name }) => ({
    value: id,
    label: name,
  }));

  return (
    <EntityMultiselect
      {...props}
      label={intl.formatMessage(ruleBuilderMessages.productsLabel)}
      options={options}
      fetch={search}
      fetchMore={getSearchFetchMoreProps(result as CommonSearchOpts, loadMore)}
    />
  );
};

export const RuleCategoryPicker = (props: PickerProps) => {
  const intl = useIntl();
  const { search, loadMore, result } = useCategorySearch({
    variables: {
      after: DEFAULT_INITIAL_SEARCH_DATA.after,
      first: DEFAULT_INITIAL_SEARCH_DATA.first,
      filter: undefined,
    },
  });
  const options = (mapEdgesToItems(result?.data?.search) ?? []).map(({ id, name }) => ({
    value: id,
    label: name,
  }));

  return (
    <EntityMultiselect
      {...props}
      label={intl.formatMessage(ruleBuilderMessages.categoriesLabel)}
      options={options}
      fetch={search}
      fetchMore={getSearchFetchMoreProps(result as CommonSearchOpts, loadMore)}
    />
  );
};
