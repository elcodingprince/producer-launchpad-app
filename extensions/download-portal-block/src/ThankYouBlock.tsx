import {
  Banner,
  BlockStack,
  Button,
  Spinner,
  Text,
  reactExtension,
  useApi,
  useExtensionEditor,
  useSessionToken,
  useSubscription,
} from '@shopify/ui-extensions-react/checkout';
import { useEffect, useState } from 'react';

const POLL_INTERVAL_MS = 2500;
const MAX_ATTEMPTS = 24;

const STAGING_APP_URL = 'https://producer-launchpad-staging.fly.dev';
const PRODUCTION_APP_URL = 'https://producer-launchpad-app.fly.dev';
const STAGING_SHOP_DOMAINS = new Set(['pl-staging.myshopify.com']);

function resolveAppUrl(shopDomain: string): string {
  return STAGING_SHOP_DOMAINS.has(shopDomain)
    ? STAGING_APP_URL
    : PRODUCTION_APP_URL;
}

type DeliveryState =
  | { status: 'loading' }
  | { status: 'ready'; downloadUrl: string }
  | { status: 'delayed' };

export default reactExtension('purchase.thank-you.block.render', () => (
  <ThankYouBlock />
));

function ThankYouBlock() {
  const editor = useExtensionEditor();
  const api = useApi<'purchase.thank-you.block.render'>();
  const sessionToken = useSessionToken();
  const orderConfirmation = useSubscription(api.orderConfirmation);
  const shopDomain = api.shop.myshopifyDomain;

  const orderId = orderConfirmation?.order?.id ?? null;
  const orderNumber = orderConfirmation?.number ?? null;

  const [state, setState] = useState<DeliveryState>({ status: 'loading' });

  useEffect(() => {
    if (editor || !orderId || !orderNumber) return;

    let cancelled = false;
    let attempts = 0;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const appUrl = resolveAppUrl(shopDomain);

    async function poll() {
      try {
        const token = await sessionToken.get();
        const res = await fetch(`${appUrl}/api/checkout/delivery-status`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ orderId, orderNumber }),
        });

        if (cancelled) return;
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = (await res.json()) as
          | { status: 'loading' }
          | { status: 'ready'; downloadUrl: string };

        if (cancelled) return;
        if (data.status === 'ready' && typeof data.downloadUrl === 'string') {
          setState({ status: 'ready', downloadUrl: data.downloadUrl });
          return;
        }
      } catch (error) {
        console.error('[Producer Launchpad] delivery status poll failed', error);
      }

      attempts += 1;
      if (cancelled) return;
      if (attempts >= MAX_ATTEMPTS) {
        setState({ status: 'delayed' });
        return;
      }
      timeoutId = setTimeout(poll, POLL_INTERVAL_MS);
    }

    poll();

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [editor, orderId, orderNumber, sessionToken, shopDomain]);

  if (editor) {
    return (
      <Banner status="info" title="Producer Launchpad delivery block">
        <Text>
          Your secure download link will appear here on the real thank-you page.
        </Text>
      </Banner>
    );
  }

  if (state.status === 'ready') {
    return (
      <Banner status="success" title="Your downloads are ready">
        <BlockStack spacing="base">
          <Text>
            Click below to open your secure download portal and grab your files.
          </Text>
          <Button kind="primary" to={state.downloadUrl}>
            Open download portal
          </Button>
        </BlockStack>
      </Banner>
    );
  }

  if (state.status === 'delayed') {
    return (
      <Banner status="info" title="Your files are still being prepared">
        <Text>
          We'll email your secure download link shortly. If you don't see it within
          a few minutes, please contact support and share your order number.
        </Text>
      </Banner>
    );
  }

  return (
    <Banner status="info" title="Preparing your downloads">
      <BlockStack spacing="base" inlineAlignment="center">
        <Spinner accessibilityLabel="Preparing your downloads" />
        <Text>One moment while we set up your secure download link.</Text>
      </BlockStack>
    </Banner>
  );
}
