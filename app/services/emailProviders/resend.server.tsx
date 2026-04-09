import { render } from "@react-email/render";
import { Resend } from "resend";
import DeliveryReadyEmail, {
  type DeliveryReadyEmailProps,
} from "~/emails/DeliveryReadyEmail";

export interface DeliveryEmailSendInput extends DeliveryReadyEmailProps {
  to: string;
  from: string;
  replyTo?: string | null;
  subject: string;
}

export interface DeliveryEmailSendResult {
  provider: "resend";
  messageId: string | null;
}

export class DeliveryEmailError extends Error {
  readonly code: string;
  readonly statusCode: number | null;

  constructor(message: string, code: string, statusCode: number | null) {
    super(message);
    this.name = "DeliveryEmailError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

export class ResendEmailProvider {
  private client: Resend;

  constructor(apiKey: string) {
    this.client = new Resend(apiKey);
  }

  async sendDeliveryEmail({
    to,
    from,
    replyTo,
    subject,
    ...templateProps
  }: DeliveryEmailSendInput): Promise<DeliveryEmailSendResult> {
    const html = await render(<DeliveryReadyEmail {...templateProps} />);

    const response = await this.client.emails.send({
      from,
      to,
      subject,
      html,
      replyTo: replyTo || undefined,
    });

    if (response.error) {
      throw new DeliveryEmailError(
        response.error.message,
        response.error.name,
        response.error.statusCode ?? null,
      );
    }

    return {
      provider: "resend",
      messageId: response.data?.id ?? null,
    };
  }
}
