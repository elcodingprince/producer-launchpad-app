import { BlockStack, Modal, Text } from "@shopify/polaris";

interface LegalGuardrailModalProps {
  open: boolean;
  templateName: string;
  accepting: boolean;
  onAccept: () => void;
  onClose: () => void;
}

export function LegalGuardrailModal({
  open,
  templateName,
  accepting,
  onAccept,
  onClose,
}: LegalGuardrailModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Finalize Your Agreement"
      primaryAction={{
        content: "I've Reviewed & Accept",
        onAction: onAccept,
        loading: accepting,
      }}
      secondaryActions={[
        {
          content: "Back",
          onAction: onClose,
          disabled: accepting,
        },
      ]}
    >
      <Modal.Section>
        <BlockStack gap="300">
          <Text as="p" variant="bodyMd">
            {templateName} is one of your Starter Presets.
          </Text>
          <Text as="p" variant="bodyMd">
            These templates are professional starting points built around common
            industry practices. Please review the language to confirm it matches
            your business needs. Producer Launchpad is a technical delivery tool
            and does not provide legal advice.
          </Text>
          <Text as="p" tone="subdued" variant="bodySm">
            You will not be able to save updates to this Starter Preset until
            you accept this review step.
          </Text>
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
}
