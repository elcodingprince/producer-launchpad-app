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
  useSettings,
  useSessionToken,
  useSubscription,
} from '@shopify/ui-extensions-react/checkout';
import { useEffect, useState } from 'react';

export default reactExtension('purchase.thank-you.block.render', () => (
  <ThankYouBlock />
));

function ThankYouBlock() {
  const editor = useExtensionEditor();
  const sessionToken = useSessionToken();
  const settings = useSettings<{app_url?: string}>();
  const api = useApi<'purchase.thank-you.block.render'>();
  const orderConfirmation =
    'orderConfirmation' in api ? useSubscription(api.orderConfirmation) : undefined;

  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const orderId = orderConfirmation?.order?.id;
  const orderNumber = orderConfirmation?.number;
  const appUrl = settings.app_url?.trim();

  useEffect(() => {
    if (editor || !appUrl || !orderId || !orderNumber) return;

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;
    const maxAttempts = 12;

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

        if (data.status === 'failed') {
          setStatus('failed');
          return;
        }

        attempts += 1;
        if (attempts >= maxAttempts) {
          setStatus('failed');
          return;
        }

        setStatus('loading');
        timeoutId = setTimeout(pollDeliveryStatus, 2500);
      } catch (_error) {
        if (cancelled) return;
        attempts += 1;
        if (attempts >= maxAttempts) {
          setStatus('failed');
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
      <Banner status="success" title="Your beats are ready!">
        <BlockStack spacing="base">
          <Text>
            Download your high-quality audio files and customized license agreement
            instantly.
          </Text>
          <Link href={downloadUrl} target="_blank">
            Access Download Portal
          </Link>
        </BlockStack>
      </Banner>
    );
  }

  // Editor/customizer preview — show a preview with disabled button
  if (editor) {
    return (
      <Banner status="success" title="Your beats are ready!">
        <BlockStack spacing="base">
          <Text>
            Download your high-quality audio files and customized license agreement
            instantly.
          </Text>
          <Button kind="primary" disabled>
            Access Download Portal
          </Button>
          <Text size="small" appearance="subdued">
            Preview mode: the real download link appears after purchase when the order
            has a generated portal URL.
          </Text>
        </BlockStack>
      </Banner>
    );
  }

  // Real order but metafield not ready yet — show a loading/preparing state
  if (status === 'loading') {
    return (
      <Banner status="info" title="Preparing your downloads...">
        <BlockStack spacing="base">
          <Text>
            Your beat files and license agreement are being prepared. This usually
            takes just a few seconds.
          </Text>
          <Spinner />
          {!appUrl ? (
            <Text size="small" appearance="subdued">
              Configure the extension App URL setting in the checkout editor to enable
              secure portal lookup.
            </Text>
          ) : null}
        </BlockStack>
      </Banner>
    );
  }

  return (
    <Banner status="critical" title="We couldn't prepare your downloads yet">
      <BlockStack spacing="base">
        <Text>
          Your order was received, but the download portal is not ready yet. Please
          refresh this page in a moment or contact support if the issue persists.
        </Text>
      </BlockStack>
    </Banner>
  );
}
