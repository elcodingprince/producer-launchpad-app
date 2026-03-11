import { useState, useCallback, useMemo } from 'react';
import {
  Combobox,
  Icon,
  Listbox,
  InlineStack,
  Tag,
  BlockStack,
} from '@shopify/polaris';
import { SearchIcon } from '@shopify/polaris-icons';

export interface Option {
  label: string;
  value: string;
}

export interface MultiSelectComboboxProps {
  label: string;
  options: Option[];
  selectedValues: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
}

export function MultiSelectCombobox({
  label,
  options,
  selectedValues,
  onChange,
  placeholder = 'Search...',
}: MultiSelectComboboxProps) {
  const [inputValue, setInputValue] = useState('');

  // Update input text without selecting anything
  const handleInputValueChange = useCallback(
    (value: string) => {
      setInputValue(value);
    },
    []
  );

  // When a listbox option is clicked
  const handleSelect = useCallback(
    (value: string) => {
      let newSelected;
      if (selectedValues.includes(value)) {
        newSelected = selectedValues.filter((v) => v !== value);
      } else {
        newSelected = [...selectedValues, value];
      }
      onChange(newSelected);
      setInputValue(''); // Reset search text after selection
    },
    [selectedValues, onChange]
  );

  // Remove individual tags
  const handleRemoveTag = useCallback(
    (tagValue: string) => {
      const newSelected = selectedValues.filter((v) => v !== tagValue);
      onChange(newSelected);
    },
    [selectedValues, onChange]
  );

  // Filter options based on input text
  const filteredOptions = useMemo(() => {
    if (!inputValue) return options;
    const lowerInput = inputValue.toLowerCase();
    return options.filter((opt) => opt.label.toLowerCase().includes(lowerInput));
  }, [inputValue, options]);

  // Generate tags for currently selected items below the combobox
  const activeTags = useMemo(() => {
    return selectedValues.map((val) => {
      const dbOpt = options.find((opt) => opt.value === val);
      return (
        <Tag key={val} onRemove={() => handleRemoveTag(val)}>
          {dbOpt ? dbOpt.label : val}
        </Tag>
      );
    });
  }, [selectedValues, options, handleRemoveTag]);

  // Map options to Listbox items
  const listboxOptions = filteredOptions.map((opt) => {
    const isSelected = selectedValues.includes(opt.value);
    return (
      <Listbox.Option key={opt.value} value={opt.value} selected={isSelected}>
        <Listbox.TextOption selected={isSelected}>{opt.label}</Listbox.TextOption>
      </Listbox.Option>
    );
  });

  return (
    <BlockStack gap="200">
      <Combobox
        allowMultiple
        activator={
          <Combobox.TextField
            prefix={<Icon source={SearchIcon} />}
            onChange={handleInputValueChange}
            label={label}
            value={inputValue}
            placeholder={placeholder}
            autoComplete="off"
          />
        }
      >
        {listboxOptions.length > 0 ? (
          <Listbox onSelect={handleSelect}>
            {listboxOptions}
          </Listbox>
        ) : (
          <Listbox.Loading accessibilityLabel="Loading" />
        )}
      </Combobox>
      {activeTags.length > 0 && (
        <InlineStack gap="200">{activeTags}</InlineStack>
      )}
    </BlockStack>
  );
}
