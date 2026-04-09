/**
 * Translates a stored error code (or legacy raw message) into copy
 * a merchant can understand. The merchant cannot fix any of these —
 * the message should reassure and point to support.
 *
 * This file is intentionally NOT `.server.ts` so it can be imported
 * by both server-side actions and client-side route components.
 */
export function getMerchantEmailErrorMessage(
  errorValue: string | null,
): string | null {
  if (!errorValue) return null;

  const normalized = errorValue.toLowerCase().trim();

  if (normalized === "missing customer email") {
    return "No email address was available for this customer at checkout.";
  }

  // Every other error is on our side — the merchant can't fix it
  return "The delivery email couldn't be sent. Try resending — if it keeps failing, contact support.";
}
