import type { ReactNode } from "react";
import { BlockStack, Checkbox, Modal } from "@shopify/polaris";

interface AcknowledgmentModalProps {
  open: boolean;
  title: string;
  children: ReactNode;
  primaryActionLabel: string;
  secondaryActionLabel: string;
  checkboxLabel?: string;
  checkboxChecked?: boolean;
  primaryActionDisabled?: boolean;
  primaryActionLoading?: boolean;
  onCheckboxChange?: (checked: boolean) => void;
  onPrimaryAction: () => void;
  onClose: () => void;
}

export function AcknowledgmentModal({
  open,
  title,
  children,
  primaryActionLabel,
  secondaryActionLabel,
  checkboxLabel,
  checkboxChecked = false,
  primaryActionDisabled = false,
  primaryActionLoading = false,
  onCheckboxChange,
  onPrimaryAction,
  onClose,
}: AcknowledgmentModalProps) {
  const requiresCheckbox = Boolean(checkboxLabel);
  const isPrimaryActionDisabled =
    primaryActionDisabled || (requiresCheckbox && !checkboxChecked);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      primaryAction={{
        content: primaryActionLabel,
        onAction: onPrimaryAction,
        loading: primaryActionLoading,
        disabled: isPrimaryActionDisabled,
      }}
      secondaryActions={[
        {
          content: secondaryActionLabel,
          onAction: onClose,
          disabled: primaryActionLoading,
        },
      ]}
    >
      <Modal.Section>
        <BlockStack gap="400">
          {children}
          {checkboxLabel ? (
            <Checkbox
              label={checkboxLabel}
              checked={checkboxChecked}
              onChange={onCheckboxChange || (() => {})}
            />
          ) : null}
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
}
