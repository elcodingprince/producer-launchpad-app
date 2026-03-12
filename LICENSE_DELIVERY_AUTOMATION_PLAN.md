# License Delivery Automation — Implementation Plan

## Overview

Automatically generate and deliver license PDFs to customers upon purchase.

**Architecture:**
```
Producer configures license templates (Basic/Premium/Exclusive)
         ↓
Upload beat → App creates variants with license_template_id metafield
         ↓
Customer purchases → Webhook triggers PDF generation + email delivery
```

---

## File Structure

```
app/
├── routes/
│   ├── app.licenses._index.tsx          # License templates list
│   ├── app.licenses.$id.edit.tsx        # Edit single template
│   ├── webhooks.orders-create.tsx       # Order webhook handler
│   └── app.upload.tsx                   # Modified to set variant metafields
├── services/
│   ├── license-template.server.ts       # CRUD operations
│   ├── license-pdf.server.ts            # PDFKit PDF generation
│   ├── license-email.server.ts          # Resend email delivery
│   └── license-delivery.server.ts       # Orchestration service
├── components/
│   └── LicensePreview.tsx               # Live preview component
└── types/
    └── license.ts                       # TypeScript interfaces
```

---

## Phase 1: Database (2 hours)

### Prisma Schema Additions

```prisma
// Add to prisma/schema.prisma

model LicenseTemplate {
  id          String   @id @default(cuid())
  shopDomain  String
  name        String   // "Basic License", "Premium License"
  tier        String   // "basic" | "premium" | "exclusive"
  htmlContent String   @db.Text
  isDefault   Boolean  @default(false)
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@unique([shopDomain, name])
  @@index([shopDomain])
}

model LicenseDelivery {
  id              String   @id @default(cuid())
  shopDomain      String
  orderId         String
  lineItemId      String
  templateId      String
  customerEmail   String
  customerName    String
  beatTitle       String
  licenseType     String
  status          String   @default("pending") // pending | sent | failed
  errorMessage    String?
  sentAt          DateTime?
  createdAt       DateTime @default(now())

  @@index([shopDomain, orderId])
  @@index([status])
}
```

**Migration:**
```bash
npx prisma migrate dev --name add_license_automation
```

---

## Phase 2: Services (6 hours)

### 2.1 License Template Service

**File:** `app/services/license-template.server.ts`

```typescript
import { prisma } from '~/db.server';

const DEFAULT_TEMPLATES = {
  basic: { name: 'Basic License', tier: 'basic' },
  premium: { name: 'Premium License', tier: 'premium' },
  exclusive: { name: 'Exclusive License', tier: 'exclusive' },
};

export async function seedDefaultTemplates(shopDomain: string) {
  for (const [key, config] of Object.entries(DEFAULT_TEMPLATES)) {
    const exists = await prisma.licenseTemplate.findFirst({
      where: { shopDomain, tier: key },
    });

    if (!exists) {
      await prisma.licenseTemplate.create({
        data: {
          shopDomain,
          name: config.name,
          tier: config.tier,
          htmlContent: getDefaultHtml(config.tier),
          isDefault: key === 'basic',
        },
      });
    }
  }
}

export async function getTemplates(shopDomain: string) {
  return prisma.licenseTemplate.findMany({
    where: { shopDomain, isActive: true },
    orderBy: { createdAt: 'asc' },
  });
}

export async function getTemplateById(id: string, shopDomain: string) {
  return prisma.licenseTemplate.findFirst({
    where: { id, shopDomain },
  });
}

export async function getTemplateByName(name: string, shopDomain: string) {
  return prisma.licenseTemplate.findFirst({
    where: { name, shopDomain },
  });
}

export async function updateTemplate(
  id: string,
  shopDomain: string,
  data: { name?: string; htmlContent?: string }
) {
  return prisma.licenseTemplate.updateMany({
    where: { id, shopDomain },
    data: { ...data, updatedAt: new Date() },
  });
}

function getDefaultHtml(tier: string): string {
  // Placeholder - user provides actual HTML templates
  return `<h1>${tier.toUpperCase()} LICENSE</h1>
<p>Granted to: {{customer_name}}</p>
<p>Beat: {{beat_title}}</p>
<p>Date: {{order_date}}</p>`;
}
```

### 2.2 PDF Generation Service

**File:** `app/services/license-pdf.server.ts`

```typescript
import PDFDocument from 'pdfkit';

interface LicenseData {
  customer_name: string;
  customer_email: string;
  beat_title: string;
  license_type: string;
  order_date: string;
  order_id: string;
  price: string;
  [key: string]: string;
}

export async function generateLicensePDF(
  templateHtml: string,
  data: LicenseData
): Promise<Buffer> {
  // Replace all {{placeholder}} with values
  let content = templateHtml;
  for (const [key, value] of Object.entries(data)) {
    content = content.replace(
      new RegExp(`{{\\s*${key}\\s*}}`, 'gi'),
      value || ''
    );
  }

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Simple HTML-to-PDF conversion
      const lines = content.split(/<\/p>|<br\s*\/?>|<\/div>|<\/h[1-6]>/i);

      for (const line of lines) {
        const cleanText = line
          .replace(/<[^>]+>/g, '') // Remove HTML tags
          .replace(/&nbsp;/g, ' ')
          .trim();

        if (cleanText) {
          doc.text(cleanText);
          doc.moveDown(0.5);
        }
      }

      // Footer
      doc.moveDown(2);
      doc.fontSize(10).text(
        `Generated by Producer Launchpad • ${new Date().toLocaleDateString()}`,
        { align: 'center' }
      );

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}
```

### 2.3 Email Service

**File:** `app/services/license-email.server.ts`

```typescript
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

interface LicenseEmailData {
  to: string;
  customerName: string;
  beatTitle: string;
  licenseType: string;
  pdfBuffer: Buffer;
  orderId: string;
}

export async function sendLicenseEmail(data: LicenseEmailData) {
  const { to, customerName, beatTitle, licenseType, pdfBuffer, orderId } = data;

  const filename = `${beatTitle.replace(/[^a-z0-9]/gi, '_')}_License.pdf`;

  return resend.emails.send({
    from: 'Producer Launchpad <licenses@producer-launchpad.com>',
    to,
    subject: `Your ${licenseType} for "${beatTitle}"`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Your License is Ready</h2>
        <p>Hi ${customerName},</p>
        <p>Thank you for purchasing <strong>"${beatTitle}"</strong>.</p>
        <p>Your <strong>${licenseType}</strong> is attached to this email.</p>
        <p>Keep this license file as proof of your rights to use the beat.</p>
        <hr/>
        <p style="color: #666; font-size: 12px;">Order ID: ${orderId}</p>
        <p style="color: #666; font-size: 12px;">Delivered by Producer Launchpad</p>
      </div>
    `,
    attachments: [{
      filename,
      content: pdfBuffer.toString('base64'),
    }],
  });
}
```

### 2.4 License Delivery Orchestrator

**File:** `app/services/license-delivery.server.ts`

```typescript
import { prisma } from '~/db.server';
import { generateLicensePDF } from './license-pdf.server';
import { sendLicenseEmail } from './license-email.server';
import { getTemplateById } from './license-template.server';

interface LineItem {
  id: string;
  variant_id: string;
  title: string;
  price: string;
}

export async function processLicenseDelivery(
  shopDomain: string,
  orderId: string,
  customerEmail: string,
  customerName: string,
  lineItems: LineItem[],
  getVariantMetafield: (variantId: string, key: string) => Promise<string | null>
) {
  const results = [];

  for (const item of lineItems) {
    try {
      // 1. Get template_id from variant metafield
      const templateId = await getVariantMetafield(
        item.variant_id,
        'license_template_id'
      );

      if (!templateId) {
        results.push({
          lineItemId: item.id,
          status: 'skipped',
          reason: 'No license template assigned'
        });
        continue;
      }

      // 2. Fetch template from DB
      const template = await getTemplateById(templateId, shopDomain);

      if (!template) {
        throw new Error(`Template ${templateId} not found`);
      }

      // 3. Prepare license data
      const licenseData = {
        customer_name: customerName,
        customer_email: customerEmail,
        beat_title: item.title,
        license_type: template.name,
        order_date: new Date().toLocaleDateString(),
        order_id: orderId,
        price: `$${item.price}`,
      };

      // 4. Generate PDF
      const pdfBuffer = await generateLicensePDF(template.htmlContent, licenseData);

      // 5. Send email
      await sendLicenseEmail({
        to: customerEmail,
        customerName,
        beatTitle: item.title,
        licenseType: template.name,
        pdfBuffer,
        orderId,
      });

      // 6. Record delivery
      await prisma.licenseDelivery.create({
        data: {
          shopDomain,
          orderId,
          lineItemId: item.id,
          templateId: template.id,
          customerEmail,
          customerName,
          beatTitle: item.title,
          licenseType: template.name,
          status: 'sent',
          sentAt: new Date(),
        },
      });

      results.push({
        lineItemId: item.id,
        status: 'sent',
        licenseType: template.name
      });

    } catch (error) {
      console.error(`License delivery failed for ${item.id}:`, error);

      await prisma.licenseDelivery.create({
        data: {
          shopDomain,
          orderId,
          lineItemId: item.id,
          templateId: 'unknown',
          customerEmail,
          customerName,
          beatTitle: item.title,
          licenseType: 'unknown',
          status: 'failed',
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
        },
      });

      results.push({
        lineItemId: item.id,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  return results;
}
```

---

## Phase 3: Webhook Handler (2 hours)

**File:** `app/routes/webhooks.orders-create.tsx`

```typescript
import type { ActionFunctionArgs } from '@remix-run/node';
import { json } from '@remix-run/node';
import { authenticate } from '~/shopify.server';
import { processLicenseDelivery } from '~/services/license-delivery.server';

export const action = async ({ request }: ActionFunctionArgs) => {
  const { topic, shop, payload, admin } = await authenticate.webhook(request);

  if (topic !== 'ORDERS_CREATE') {
    return json({ success: true });
  }

  const order = payload;

  try {
    // Helper to fetch variant metafield
    const getVariantMetafield = async (variantId: string, key: string) => {
      const response = await admin.graphql(`
        query GetVariantMetafield($id: ID!, $key: String!) {
          productVariant(id: $id) {
            metafield(namespace: "producer_launchpad", key: $key) {
              value
            }
          }
        }
      `, {
        variables: {
          id: `gid://shopify/ProductVariant/${variantId}`,
          key,
        },
      });

      const data = await response.json();
      return data.data?.productVariant?.metafield?.value || null;
    };

    // Process delivery
    const results = await processLicenseDelivery(
      shop,
      order.id.toString(),
      order.email,
      order.customer?.first_name || 'Customer',
      order.line_items.map((item: any) => ({
        id: item.id,
        variant_id: item.variant_id,
        title: item.title,
        price: item.price,
      })),
      getVariantMetafield
    );

    console.log(`Order ${order.id} license delivery:`, results);

    return json({ success: true, results });
  } catch (error) {
    console.error('Webhook processing error:', error);
    // Return 200 to prevent retries for unrecoverable errors
    return json({ success: false }, { status: 200 });
  }
};
```

**Update `shopify.app.toml`:**
```toml
[[webhooks.subscriptions]]
topics = [ "orders/create" ]
uri = "/webhooks/orders-create"
```

---

## Phase 4: UI Components (8 hours)

### 4.1 License Templates List Page

**File:** `app/routes/app.licenses._index.tsx`

```typescript
import { useLoaderData } from '@remix-run/react';
import { json, type LoaderFunctionArgs } from '@remix-run/node';
import { Page, Layout, Card, ResourceList, ResourceItem, Button, Badge } from '@shopify/polaris';
import { getTemplates } from '~/services/license-template.server';
import { authenticate } from '~/shopify.server';

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const templates = await getTemplates(session.shop);
  return json({ templates });
};

export default function LicensesPage() {
  const { templates } = useLoaderData<typeof loader>();

  return (
    <Page
      title="License Templates"
      subtitle="Customize licenses assigned to your beats"
      primaryAction={{
        content: 'Add Template',
        url: '/app/licenses/new',
      }}
    >
      <Layout>
        <Layout.Section>
          <Card>
            <ResourceList
              items={templates}
              renderItem={(template) => (
                <ResourceItem
                  id={template.id}
                  url={`/app/licenses/${template.id}/edit`}
                  accessibilityLabel={`Edit ${template.name}`}
                >
                  <h3>{template.name}</h3>
                  <p>Tier: {template.tier}</p>
                  {template.isDefault && <Badge status="info">Default</Badge>}
                </ResourceItem>
              )}
            />
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
```

### 4.2 Edit Template Page

**File:** `app/routes/app.licenses.$id.edit.tsx`

```typescript
import { useLoaderData, useSubmit } from '@remix-run/react';
import { json, type LoaderFunctionArgs, type ActionFunctionArgs } from '@remix-run/node';
import { Page, Layout, Card, Form, TextField, Button, Frame, Toast } from '@shopify/polaris';
import { useState } from 'react';
import { authenticate } from '~/shopify.server';
import { getTemplateById, updateTemplate } from '~/services/license-template.server';

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const template = await getTemplateById(params.id!, session.shop);
  if (!template) throw new Response('Not found', { status: 404 });
  return json({ template });
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();

  await updateTemplate(params.id!, session.shop, {
    name: formData.get('name') as string,
    htmlContent: formData.get('htmlContent') as string,
  });

  return json({ success: true });
};

export default function EditLicensePage() {
  const { template } = useLoaderData<typeof loader>();
  const submit = useSubmit();
  const [name, setName] = useState(template.name);
  const [htmlContent, setHtmlContent] = useState(template.htmlContent);
  const [showToast, setShowToast] = useState(false);

  const handleSave = () => {
    const formData = new FormData();
    formData.append('name', name);
    formData.append('htmlContent', htmlContent);
    submit(formData, { method: 'post' });
    setShowToast(true);
  };

  return (
    <Frame>
      <Page
        title={`Edit: ${template.name}`}
        backAction={{ url: '/app/licenses' }}
        primaryAction={{
          content: 'Save',
          onAction: handleSave,
        }}
      >
        <Layout>
          <Layout.Section>
            <Card sectioned title="Template Details">
              <Form onSubmit={handleSave}>
                <TextField
                  label="License Name"
                  value={name}
                  onChange={setName}
                  helpText="This will be the variant name when uploading beats"
                />

                <div style={{ marginTop: 16 }}>
                  <TextField
                    label="HTML Template"
                    value={htmlContent}
                    onChange={setHtmlContent}
                    multiline={10}
                    helpText="Use {{customer_name}}, {{beat_title}}, {{order_date}}, {{order_id}}, {{price}} as placeholders"
                  />
                </div>
              </Form>
            </Card>
          </Layout.Section>

          <Layout.Section secondary>
            <Card sectioned title="Available Placeholders">
              <ul>
                <li>{`{{customer_name}}`}</li>
                <li>{`{{customer_email}}`}</li>
                <li>{`{{beat_title}}`}</li>
                <li>{`{{license_type}}`}</li>
                <li>{`{{order_date}}`}</li>
                <li>{`{{order_id}}`}</li>
                <li>{`{{price}}`}</li>
              </ul>
            </Card>
          </Layout.Section>
        </Layout>

        {showToast && (
          <Toast content="License template saved" onDismiss={() => setShowToast(false)} />
        )}
      </Page>
    </Frame>
  );
}
```

### 4.3 Modified Upload — Set Variant Metafields

During beat upload, when creating variants:

```typescript
// In your upload route, when creating variants:
async function createVariantWithLicense(
  admin: any,
  productId: string,
  licenseTemplate: { id: string; name: string },
  price: number
) {
  const response = await admin.graphql(`
    mutation CreateVariantWithMetafield($input: ProductVariantInput!) {
      productVariantCreate(input: $input) {
        productVariant {
          id
        }
      }
    }
  `, {
    variables: {
      input: {
        productId,
        price,
        options: [licenseTemplate.name], // Variant name = license name
        metafields: [{
          namespace: 'producer_launchpad',
          key: 'license_template_id',
          value: licenseTemplate.id,
          type: 'single_line_text_field',
        }],
      },
    },
  });

  return response;
}
```

---

## Phase 5: Environment & Dependencies (30 min)

### Install Dependencies
```bash
npm install pdfkit @types/pdfkit resend
```

### Environment Variables
```bash
# .env
RESEND_API_KEY=re_xxxxxxxxxxxxxxxx
RESEND_FROM_EMAIL=licenses@producer-launchpad.com
```

---

## Phase 6: Testing & Deployment (3 hours)

### Test Checklist
- [ ] Seed default templates on app install
- [ ] Create/edit templates in UI
- [ ] Upload beat → verify variant has `license_template_id` metafield
- [ ] Place test order → verify PDF generation
- [ ] Verify email delivery with attachment
- [ ] Check delivery history in DB

### Deployment Steps
1. Run migration: `npx prisma migrate deploy`
2. Deploy app
3. Register webhook: `shopify app deploy`
4. Test end-to-end

---

## Timeline Summary

| Phase | Hours | Deliverable |
|-------|-------|-------------|
| Database | 2 | Schema + migration |
| Services | 6 | PDF, email, delivery logic |
| Webhook | 2 | Order processing |
| UI | 8 | Templates CRUD + upload integration |
| Setup | 0.5 | Dependencies + env |
| Testing | 3 | End-to-end validation |
| **Total** | **21.5 hours** | **3 dev days** |

---

## Files to Create/Modify

```
✅ prisma/schema.prisma (update)
✅ app/services/license-template.server.ts (new)
✅ app/services/license-pdf.server.ts (new)
✅ app/services/license-email.server.ts (new)
✅ app/services/license-delivery.server.ts (new)
✅ app/routes/webhooks.orders-create.tsx (new)
✅ app/routes/app.licenses._index.tsx (new)
✅ app/routes/app.licenses.$id.edit.tsx (new)
🔄 app/routes/app.upload.tsx (modify variant creation)
🔄 shopify.app.toml (add webhook)
🔄 .env (add Resend config)
```

---

## Cost Breakdown

| Component | Monthly Cost (Launch) | Monthly Cost (100 customers) |
|-----------|----------------------|------------------------------|
| Email (Resend) | $0 (3,000/mo free) | $20 (50,000/mo) |
| PDF Generation | $0 (PDFKit open source) | $0 |
| **Total** | **$0** | **$20** |

**Margin at 100 customers:** 99.9% (revenue: $14,700/mo, costs: ~$60-90/mo total)
