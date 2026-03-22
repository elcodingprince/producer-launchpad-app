import * as React from "react";
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";

export interface DeliveryReadyEmailProps {
  brandName: string;
  storeName: string;
  customerFirstName?: string | null;
  portalUrl: string;
  orderNumber?: string | null;
  itemSummary?: string | null;
  items?: DeliveryReadyEmailItem[] | null;
  supportEmail?: string | null;
  logoUrl?: string | null;
}

export interface DeliveryReadyEmailItem {
  beatTitle: string;
  licenseName: string;
  deliveryFormats?: string[] | null;
}

export function DeliveryReadyEmail({
  brandName,
  storeName,
  customerFirstName,
  portalUrl,
  orderNumber,
  itemSummary,
  items,
  supportEmail,
  logoUrl,
}: DeliveryReadyEmailProps) {
  const previewText = `Your files from ${storeName} are ready`;
  const greetingName = customerFirstName?.trim() || "there";
  const hasItems = Boolean(items?.length);

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={card}>
            {logoUrl ? (
              <Img
                alt={`${storeName} logo`}
                height="48"
                src={logoUrl}
                style={logo}
              />
            ) : null}

            <Text style={eyebrow}>{brandName}</Text>
            <Heading style={heading}>Your files are ready</Heading>
            <Text style={paragraph}>Hi {greetingName},</Text>
            <Text style={paragraph}>
              Your purchase from {storeName} is ready. Use the secure portal
              below to access your beat files and license agreement.
            </Text>

            <Section style={ctaSection}>
              <Button href={portalUrl} style={button}>
                Open download portal
              </Button>
            </Section>

            {orderNumber || itemSummary || hasItems ? (
              <>
                <Hr style={divider} />
                <Section>
                  {orderNumber ? (
                    <Text style={metaLine}>
                      <strong>Order:</strong> #{orderNumber}
                    </Text>
                  ) : null}
                  {itemSummary && !hasItems ? (
                    <Text style={metaLine}>
                      <strong>Items:</strong> {itemSummary}
                    </Text>
                  ) : null}
                </Section>
                {hasItems ? (
                  <Section style={itemsSection}>
                    <Text style={sectionLabel}>Order items</Text>
                    <Section style={itemsPanel}>
                      {items?.map((item, index) => (
                        <Section
                          key={`${item.beatTitle}-${item.licenseName}-${index}`}
                          style={{
                            ...itemRow,
                            ...(index === (items?.length || 0) - 1
                              ? lastItemRow
                              : null),
                          }}
                        >
                          <Text style={itemTitle}>{item.beatTitle}</Text>
                          <Text style={itemSubtitle}>{item.licenseName}</Text>
                          <Section style={nestedAddonRow}>
                            <div style={connectorColumn}>
                              <div style={connectorVertical} />
                              <div style={connectorCurve} />
                            </div>
                            <div style={nestedAddonContent}>
                              <Text style={nestedAddonTitle}>
                                {(item.deliveryFormats || []).join(" + ") ||
                                  "MP3"}
                              </Text>
                            </div>
                          </Section>
                        </Section>
                      ))}
                    </Section>
                  </Section>
                ) : null}
              </>
            ) : null}

            <Hr style={divider} />
            <Text style={paragraph}>
              If the button above doesn&apos;t work, copy and paste this link
              into your browser:
            </Text>
            <Link href={portalUrl} style={link}>
              {portalUrl}
            </Link>

            <Text style={footer}>
              Keep this link private. If you need help accessing your files
              {supportEmail
                ? `, contact ${supportEmail}.`
                : ", reply to this email."}
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

const main = {
  backgroundColor: "#f6f7f8",
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  margin: 0,
  padding: "32px 0",
};

const container = {
  margin: "0 auto",
  maxWidth: "600px",
  padding: "0 16px",
};

const card = {
  backgroundColor: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: "16px",
  padding: "32px",
};

const logo = {
  borderRadius: "12px",
  display: "block",
  marginBottom: "20px",
};

const eyebrow = {
  color: "#6b7280",
  fontSize: "12px",
  fontWeight: "600",
  letterSpacing: "0.08em",
  margin: "0 0 8px",
  textTransform: "uppercase" as const,
};

const heading = {
  color: "#111827",
  fontSize: "30px",
  lineHeight: "36px",
  margin: "0 0 16px",
};

const paragraph = {
  color: "#374151",
  fontSize: "16px",
  lineHeight: "26px",
  margin: "0 0 16px",
};

const ctaSection = {
  margin: "28px 0",
};

const button = {
  backgroundColor: "#111827",
  borderRadius: "10px",
  color: "#ffffff",
  display: "inline-block",
  fontSize: "16px",
  fontWeight: "600",
  padding: "14px 24px",
  textDecoration: "none",
};

const divider = {
  borderColor: "#e5e7eb",
  margin: "24px 0",
};

const metaLine = {
  color: "#111827",
  fontSize: "14px",
  lineHeight: "22px",
  margin: "0 0 8px",
};

const itemsSection = {
  marginTop: "12px",
};

const sectionLabel = {
  color: "#6b7280",
  fontSize: "12px",
  fontWeight: "600",
  letterSpacing: "0.08em",
  margin: "0 0 12px",
  textTransform: "uppercase" as const,
};

const itemsPanel = {
  backgroundColor: "#f8fafc",
  border: "1px solid #e5e7eb",
  borderRadius: "14px",
};

const itemRow = {
  borderBottom: "1px solid #e5e7eb",
  padding: "16px 18px",
};

const lastItemRow = {
  borderBottom: "none",
};

const itemTitle = {
  color: "#374151",
  fontSize: "18px",
  fontWeight: "500",
  lineHeight: "24px",
  margin: "0 0 4px",
};

const itemSubtitle = {
  color: "#8b8b8b",
  fontSize: "15px",
  fontWeight: "400",
  lineHeight: "22px",
  margin: "0 0 6px",
};

const nestedAddonRow = {
  marginTop: "10px",
};

const connectorColumn = {
  display: "inline-block",
  height: "34px",
  position: "relative" as const,
  verticalAlign: "top" as const,
  width: "26px",
};

const connectorVertical = {
  borderLeft: "2px solid #d1d5db",
  height: "18px",
  left: "10px",
  position: "absolute" as const,
  top: "-6px",
};

const connectorCurve = {
  borderBottom: "2px solid #d1d5db",
  borderBottomLeftRadius: "10px",
  borderLeft: "2px solid #d1d5db",
  height: "16px",
  left: "10px",
  position: "absolute" as const,
  top: "10px",
  width: "14px",
};

const nestedAddonContent = {
  display: "inline-block",
  paddingTop: "6px",
  verticalAlign: "top" as const,
};

const nestedAddonTitle = {
  color: "#6b7280",
  fontSize: "14px",
  fontWeight: "400",
  lineHeight: "20px",
  margin: 0,
};

const link = {
  color: "#2563eb",
  display: "block",
  fontSize: "14px",
  lineHeight: "22px",
  marginBottom: "20px",
  wordBreak: "break-all" as const,
};

const footer = {
  color: "#6b7280",
  fontSize: "13px",
  lineHeight: "20px",
  margin: 0,
};

export default DeliveryReadyEmail;
