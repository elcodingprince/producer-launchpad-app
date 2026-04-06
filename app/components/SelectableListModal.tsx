import {
  ActionList,
  BlockStack,
  Box,
  Button,
  Checkbox,
  Divider,
  Icon,
  InlineStack,
  Modal,
  Popover,
  Scrollable,
  Text,
  TextField,
} from "@shopify/polaris";
import { AlertCircleIcon } from "@shopify/polaris-icons";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type SelectableListItem = {
  id: string;
  title: string;
  subtitle?: string | null;
};

interface SelectableListModalProps {
  open: boolean;
  title: string;
  resourceLabel: string;
  searchValue: string;
  searchPlaceholder: string;
  showSelectedOnly: boolean;
  items: SelectableListItem[];
  selectedIds: string[];
  hasUnsavedChanges?: boolean;
  primaryActionLabel: string;
  primaryActionLoading?: boolean;
  primaryActionDisabled?: boolean;
  emptyStateTitle: string;
  emptyStateBody: string;
  onSearchChange: (value: string) => void;
  onShowSelectedOnlyChange: (checked: boolean) => void;
  onToggleItem: (id: string) => void;
  onSelectAllVisible: () => void;
  onClearAllSelected: () => void;
  onPrimaryAction: () => void;
  onClose: () => void;
  children?: React.ReactNode;
}

export function SelectableListModal({
  open,
  title,
  resourceLabel,
  searchValue,
  searchPlaceholder,
  showSelectedOnly,
  items,
  selectedIds,
  hasUnsavedChanges = false,
  primaryActionLabel,
  primaryActionLoading = false,
  primaryActionDisabled = false,
  emptyStateTitle,
  emptyStateBody,
  onSearchChange,
  onShowSelectedOnlyChange,
  onToggleItem,
  onSelectAllVisible,
  onClearAllSelected,
  onPrimaryAction,
  onClose,
  children,
}: SelectableListModalProps) {
  const modalContentRef = useRef<HTMLDivElement | null>(null);
  const [selectionActionsOpen, setSelectionActionsOpen] = useState(false);
  const [blockedCloseAttemptCount, setBlockedCloseAttemptCount] = useState(0);
  const selectedCount = selectedIds.length;
  const visibleItemIds = useMemo(() => items.map((item) => item.id), [items]);
  const allVisibleSelected =
    visibleItemIds.length > 0 &&
    visibleItemIds.every((id) => selectedIds.includes(id));
  const someVisibleSelected =
    visibleItemIds.length > 0 &&
    visibleItemIds.some((id) => selectedIds.includes(id));
  const selectionLabel =
    selectedCount > 0 ? `${selectedCount} selected` : resourceLabel;
  const selectionActionItems = allVisibleSelected
    ? [{ content: "Unselect all", onAction: onClearAllSelected }]
    : [
        {
          content: `Select all ${visibleItemIds.length} on page`,
          onAction: onSelectAllVisible,
        },
        ...(selectedCount > 0
          ? [{ content: "Unselect all", onAction: onClearAllSelected }]
          : []),
      ];

  const handleSelectionToggle = useCallback(() => {
    if (allVisibleSelected) {
      onClearAllSelected();
      return;
    }

    onSelectAllVisible();
  }, [allVisibleSelected, onClearAllSelected, onSelectAllVisible]);

  const handleRequestClose = useCallback(() => {
    if (hasUnsavedChanges) {
      setBlockedCloseAttemptCount((count) => count + 1);
      return;
    }

    onClose();
  }, [hasUnsavedChanges, onClose]);

  useEffect(() => {
    if (!open || !hasUnsavedChanges) {
      setBlockedCloseAttemptCount(0);
    }
  }, [hasUnsavedChanges, open]);

  useEffect(() => {
    if (blockedCloseAttemptCount === 0) return;

    const dialog = modalContentRef.current?.closest('[role="dialog"]');
    if (!(dialog instanceof HTMLElement)) return;

    const buttons = Array.from(dialog.querySelectorAll("button")).slice(-2);
    const footerButtons = buttons.filter(
      (button): button is HTMLButtonElement => button instanceof HTMLButtonElement,
    );

    if (footerButtons.length === 0) return;

    footerButtons.forEach((button) => {
      button.style.animation = "none";
      button.getBoundingClientRect();
      button.style.animation = "SelectableListModal-shake 220ms ease";
    });

    const timeoutId = window.setTimeout(() => {
      footerButtons.forEach((button) => {
        button.style.animation = "";
      });
    }, 240);

    return () => {
      window.clearTimeout(timeoutId);
      footerButtons.forEach((button) => {
        button.style.animation = "";
      });
    };
  }, [blockedCloseAttemptCount]);

  const showUnsavedChangesFeedback =
    hasUnsavedChanges && blockedCloseAttemptCount > 0;

  const selectionRowClassName = [
    "SelectableListModal__row",
    "SelectableListModal__row--header",
    allVisibleSelected || someVisibleSelected
      ? "SelectableListModal__row--selected"
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Modal
      open={open}
      onClose={handleRequestClose}
      title={title}
      footer={
        showUnsavedChangesFeedback ? (
          <InlineStack gap="150" blockAlign="center">
            <Icon source={AlertCircleIcon} tone="base" />
            <Text as="p" variant="bodyMd" fontWeight="medium">
              Unsaved changes
            </Text>
          </InlineStack>
        ) : undefined
      }
      primaryAction={{
        content: primaryActionLabel,
        onAction: onPrimaryAction,
        loading: primaryActionLoading,
        disabled: primaryActionDisabled,
      }}
      secondaryActions={[
        {
          content: "Cancel",
          onAction: onClose,
          disabled: primaryActionLoading,
        },
      ]}
    >
      <Modal.Section>
        <style>
          {`
            @keyframes SelectableListModal-shake {
              0% { transform: translateX(0); }
              25% { transform: translateX(-4px); }
              50% { transform: translateX(4px); }
              75% { transform: translateX(-2px); }
              100% { transform: translateX(0); }
            }

            .SelectableListModal__row {
              cursor: pointer;
              border-radius: 8px;
              transition: background-color 120ms ease;
            }

            .SelectableListModal__row:hover {
              background: var(--p-color-bg-surface-secondary-hover);
            }

            .SelectableListModal__row--selected,
            .SelectableListModal__row--selected:hover {
              background: var(--p-color-bg-surface-secondary-active);
            }

          `}
        </style>
        <div ref={modalContentRef}>
          <BlockStack gap="0">
          <Box padding="200">
            <BlockStack gap="200">
              {children}
              <TextField
                labelHidden
                label="Search"
                value={searchValue}
                onChange={onSearchChange}
                autoComplete="off"
                placeholder={searchPlaceholder}
              />
            </BlockStack>
          </Box>

          <Divider />

          <Box padding="200">
            <div
              className={selectionRowClassName}
              onClick={handleSelectionToggle}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  handleSelectionToggle();
                }
              }}
              role="button"
              tabIndex={0}
            >
              <InlineStack align="space-between" blockAlign="center">
                <InlineStack gap="200" blockAlign="center">
                  <div onClick={(event) => event.stopPropagation()}>
                    <Checkbox
                      label=""
                      checked={allVisibleSelected || someVisibleSelected}
                      onChange={handleSelectionToggle}
                    />
                  </div>
                  <Popover
                    active={selectionActionsOpen}
                    autofocusTarget="first-node"
                    preferredAlignment="left"
                    preferredPosition="below"
                    onClose={() => setSelectionActionsOpen(false)}
                    activator={
                      selectedCount > 0 ? (
                        <div onClick={(event) => event.stopPropagation()}>
                          <Button
                            disclosure
                            onClick={() =>
                              setSelectionActionsOpen((current) => !current)
                            }
                          >
                            {selectionLabel}
                          </Button>
                        </div>
                      ) : (
                        <Text as="p" variant="bodyMd" fontWeight="medium">
                          {resourceLabel}
                        </Text>
                      )
                    }
                  >
                    <ActionList items={selectionActionItems} />
                  </Popover>
                </InlineStack>

                <div onClick={(event) => event.stopPropagation()}>
                  <Checkbox
                    label="Show all selected"
                    checked={showSelectedOnly}
                    onChange={onShowSelectedOnlyChange}
                  />
                </div>
              </InlineStack>
            </div>
          </Box>

          <Divider />

          <Scrollable style={{ maxHeight: "360px" }}>
            <BlockStack gap="0">
              {items.length === 0 ? (
                <Box padding="300">
                  <BlockStack gap="100">
                    <Text as="p" variant="bodyMd" fontWeight="medium">
                      {emptyStateTitle}
                    </Text>
                    <Text as="p" tone="subdued">
                      {emptyStateBody}
                    </Text>
                  </BlockStack>
                </Box>
              ) : (
                items.map((item, index) => {
                  const checked = selectedIds.includes(item.id);
                  const itemRowClassName = [
                    "SelectableListModal__row",
                    checked ? "SelectableListModal__row--selected" : "",
                  ]
                    .filter(Boolean)
                    .join(" ");

                  return (
                    <Box
                      key={item.id}
                      padding="200"
                      borderBlockEndWidth={index === items.length - 1 ? "0" : "025"}
                      borderColor="border"
                    >
                      <div
                        className={itemRowClassName}
                        onClick={() => onToggleItem(item.id)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            onToggleItem(item.id);
                          }
                        }}
                        role="button"
                        tabIndex={0}
                      >
                        <InlineStack gap="300" blockAlign="center">
                          <div onClick={(event) => event.stopPropagation()}>
                            <Checkbox
                              label=""
                              checked={checked}
                              onChange={() => onToggleItem(item.id)}
                            />
                          </div>
                          <BlockStack gap="050">
                            <Text as="p" variant="bodyMd" fontWeight="medium">
                              {item.title}
                            </Text>
                            {item.subtitle ? (
                              <Text as="p" variant="bodySm" tone="subdued">
                                {item.subtitle}
                              </Text>
                            ) : null}
                          </BlockStack>
                        </InlineStack>
                      </div>
                    </Box>
                  );
                })
              )}
            </BlockStack>
          </Scrollable>
          </BlockStack>
        </div>
      </Modal.Section>
    </Modal>
  );
}
