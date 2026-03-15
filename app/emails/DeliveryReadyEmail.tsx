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
  supportEmail?: string | null;
  logoUrl?: string | null;
}

export function DeliveryReadyEmail({
  brandName,
  storeName,
  customerFirstName,
  portalUrl,
  orderNumber,
  itemSummary,
  supportEmail,
  logoUrl,
}: DeliveryReadyEmailProps) {
  const previewText = `Your files from ${storeName} are ready`;
  const greetingName = customerFirstName?.trim() || "there";

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
              Your purchase from {storeName} is ready. Use the secure portal below to
              access your beat files and license agreement.
            </Text>

            <Section style={ctaSection}>
              <Button href={portalUrl} style={button}>
                Open download portal
              </Button>
            </Section>

            {orderNumber || itemSummary ? (
              <>
                <Hr style={divider} />
                <Section>
                  {orderNumber ? (
                    <Text style={metaLine}>
                      <strong>Order:</strong> #{orderNumber}
                    </Text>
                  ) : null}
                  {itemSummary ? (
                    <Text style={metaLine}>
                      <strong>Items:</strong> {itemSummary}
                    </Text>
                  ) : null}
                </Section>
              </>
            ) : null}

            <Hr style={divider} />
            <Text style={paragraph}>
              If the button above doesn&apos;t work, copy and paste this link into your
              browser:
            </Text>
            <Link href={portalUrl} style={link}>
              {portalUrl}
            </Link>

            <Text style={footer}>
              Keep this link private. If you need help accessing your files
              {supportEmail ? `, contact ${supportEmail}.` : ", reply to this email."}
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

const main = {
  backgroundColor: "#f6f7f8",
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
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
