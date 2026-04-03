import {
  Banner,
  BlockStack,
  Button,
  Link,
  Spinner,
  Text,
  reactExtension,
  useApi,
  useExtensionEditor,
  useSessionToken,
  useSubscription,
} from '@shopify/ui-extensions-react/checkout';
import { useEffect, useState } from 'react';

export default reactExtension('purchase.thank-you.block.render', () => (
  <ThankYouBlock />
));

function ThankYouBlock() {
  const editor = useExtensionEditor();
  const api = useApi<'purchase.thank-you.block.render'>();
  const sessionToken = useSessionToken();
  const orderConfirmation = useSubscription(api.orderConfirmation);

  const [status, setStatus] = useState<'loading' | 'ready' | 'delayed'>('loading');
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const orderId = orderConfirmation?.order?.id;
  const orderNumber = orderConfirmation?.number;
  const appUrl = 'https://producer-launchpad-staging.fly.dev';

  useEffect(() => {
    if (editor || !appUrl || !orderId || !orderNumber) return;

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;
    const maxAttempts = 24;

    async function pollDeliveryStatus() {
      if (!appUrl || !orderId || !orderNumber) return;
      try {
        const token = await sessionToken.get();
        const requestUrl = new URL('/api/checkout/delivery-status', appUrl);
        requestUrl.searchParams.set('orderId', orderId);
        requestUrl.searchParams.set('orderNumber', orderNumber);

        const response = await fetch(
          requestUrl.toString(),
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              orderId,
              orderNumber,
            }),
          }
        );

        if (!response.ok) {
          throw new Error(`Delivery status request failed with ${response.status}`);
        }

        const data = await response.json();

        if (cancelled) return;

        if (data.status === 'ready' && typeof data.downloadUrl === 'string') {
          setDownloadUrl(data.downloadUrl);
          setStatus('ready');
          return;
        }

        attempts += 1;
        if (attempts >= maxAttempts) {
          setStatus('delayed');
          return;
        }

        setStatus('loading');
        timeoutId = setTimeout(pollDeliveryStatus, 2500);
      } catch (_error) {
        if (cancelled) return;
        attempts += 1;
        if (attempts >= maxAttempts) {
          setStatus('delayed');
          return;
        }
        timeoutId = setTimeout(pollDeliveryStatus, 2500);
      }
    }

    pollDeliveryStatus();

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [appUrl, editor, orderId, orderNumber, sessionToken]);

  // Download URL is ready — show the real download button
  if (status === 'ready' && typeof downloadUrl === 'string' && downloadUrl.length > 0) {
    return (
      <Banner status="success" title="Your download portal is ready">
        <BlockStack spacing="base">
          <Text>
            Your files are ready. You can open your download portal below or use the
            delivery email we just sent.
          </Text>
          <Link to={downloadUrl} external>
            Open download portal
          </Link>
        </BlockStack>
      </Banner>
    );
  }

  // Editor/customizer preview — show a preview with disabled button
  if (editor) {
    return (
      <Banner status="info" title="Your files will be delivered shortly">
        <BlockStack spacing="base">
          <Text>
            After purchase, customers will see a delivery message here and can open
            the download portal as soon as it is ready.
          </Text>
          <Button kind="primary" disabled>
            Open download portal
          </Button>
          <Text size="small" appearance="subdued">
            Preview mode: this block starts with an email-delivery message and upgrades
            to the portal when it becomes available.
          </Text>
        </BlockStack>
      </Banner>
    );
  }

  // Real order but metafield not ready yet — show a loading/preparing state
  if (status === 'loading') {
    return (
      <Banner status="info" title="Your files are being prepared">
        <BlockStack spacing="base">
          <Text>
            Your files are being prepared and will be delivered to your email shortly.
          </Text>
          <Text size="small" appearance="subdued">
            If your download portal is ready in time, it will appear here automatically.
          </Text>
          <Spinner />
        </BlockStack>
      </Banner>
    );
  }

  return (
    <Banner status="info" title="Your order is confirmed">
      <BlockStack spacing="base">
        <Text>
          Your files are still being prepared and will be delivered to your email
          shortly.
        </Text>
        <Text size="small" appearance="subdued">
          If you do not see the email soon, check spam or promotions, then contact
          support with your order number.
        </Text>
      </BlockStack>
    </Banner>
  );
}
