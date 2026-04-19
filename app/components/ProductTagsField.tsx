import { useCallback, useId, useMemo, useState } from "react";
import { BlockStack, InlineStack, Tag, Text } from "@shopify/polaris";

type ProductTagsFieldProps = {
  label: string;
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
};

function normalizeTagValue(value: string) {
  return value.replace(/\s+/g, " ").trim().replace(/^,+|,+$/g, "");
}

function parseTagValues(value: string) {
  return value
    .split(/[\n,]/)
    .map(normalizeTagValue)
    .filter(Boolean);
}

function mergeUniqueTags(existing: string[], nextValues: string[]) {
  const seen = new Set(existing.map((tag) => tag.toLowerCase()));
  const merged = [...existing];

  nextValues.forEach((tag) => {
    const normalizedKey = tag.toLowerCase();
    if (seen.has(normalizedKey)) return;
    seen.add(normalizedKey);
    merged.push(tag);
  });

  return merged;
}

export function ProductTagsField({
  label,
  tags,
  onChange,
  placeholder = "Add tags",
}: ProductTagsFieldProps) {
  const [inputValue, setInputValue] = useState("");
  const inputId = useId();

  const commitInputValue = useCallback(() => {
    const parsedTags = parseTagValues(inputValue);
    if (parsedTags.length === 0) {
      setInputValue("");
      return;
    }

    onChange(mergeUniqueTags(tags, parsedTags));
    setInputValue("");
  }, [inputValue, onChange, tags]);

  const handleRemoveTag = useCallback(
    (tagToRemove: string) => {
      onChange(tags.filter((tag) => tag !== tagToRemove));
    },
    [onChange, tags],
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (
        event.key === "Enter" ||
        event.key === "," ||
        (event.key === "Tab" && inputValue.trim().length > 0)
      ) {
        event.preventDefault();
        commitInputValue();
        return;
      }

      if (event.key === "Backspace" && inputValue.length === 0 && tags.length > 0) {
        event.preventDefault();
        onChange(tags.slice(0, -1));
      }
    },
    [commitInputValue, inputValue, onChange, tags],
  );

  const handlePaste = useCallback(
    (event: React.ClipboardEvent<HTMLInputElement>) => {
      const pastedText = event.clipboardData.getData("text");
      if (!/[\n,]/.test(pastedText)) return;

      event.preventDefault();
      const parsedTags = parseTagValues(pastedText);
      if (parsedTags.length === 0) return;

      onChange(mergeUniqueTags(tags, parsedTags));
      setInputValue("");
    },
    [onChange, tags],
  );

  const renderedTags = useMemo(
    () =>
      tags.map((tag) => (
        <Tag key={tag} onRemove={() => handleRemoveTag(tag)}>
          {tag}
        </Tag>
      )),
    [handleRemoveTag, tags],
  );

  return (
    <BlockStack gap="200">
      <style>
        {`
          .ProductTagsField {
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
          }

          .ProductTagsField__label {
            color: var(--p-color-text);
            font-size: 0.875rem;
            font-weight: 450;
            line-height: 1.25rem;
          }

          .ProductTagsField__input {
            width: 100%;
            border: 0.0625rem solid var(--p-color-border);
            border-radius: 0.75rem;
            padding: 0.53125rem 0.75rem;
            color: var(--p-color-text);
            font: inherit;
            line-height: 1.25rem;
            background: var(--p-color-bg-surface);
            outline: none;
            box-sizing: border-box;
            transition:
              border-color 120ms ease,
              box-shadow 120ms ease;
          }

          .ProductTagsField__input::placeholder {
            color: var(--p-color-text-secondary);
          }

          .ProductTagsField__input:hover {
            border-color: var(--p-color-border-hover);
          }

          .ProductTagsField__input:focus {
            border-color: var(--p-color-border-focus);
            box-shadow: 0 0 0 0.125rem var(--p-color-border-focus);
          }
        `}
      </style>

      <div className="ProductTagsField">
        <label className="ProductTagsField__label" htmlFor={inputId}>
          <Text as="span" variant="bodyMd">
            {label}
          </Text>
        </label>

        <input
          id={inputId}
          className="ProductTagsField__input"
          type="text"
          value={inputValue}
          placeholder={placeholder}
          autoComplete="off"
          onChange={(event) => setInputValue(event.currentTarget.value)}
          onKeyDown={handleKeyDown}
          onBlur={commitInputValue}
          onPaste={handlePaste}
        />

        {renderedTags.length > 0 ? (
          <InlineStack gap="200">{renderedTags}</InlineStack>
        ) : null}
      </div>
    </BlockStack>
  );
}
