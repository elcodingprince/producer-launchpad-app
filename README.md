# Producer Launchpad - Shopify Embedded App

A Shopify Embedded App built with Remix that allows music producers to upload beats with automatic metafield configuration. No manual Shopify setup required.

## Features

- **Auto-Setup on Install**: Automatically creates all required metafield definitions, metaobject definitions, and default licenses
- **Drag-and-Drop Upload**: Easy file upload for MP3 previews, WAV files, stems ZIP, and cover art
- **License Management**: Create and manage beat licensing tiers (Basic, Premium, Unlimited)
- **Polaris UI**: Native Shopify Admin interface using Polaris design system
- **Cloudflare R2 Integration**: Managed file storage and delivery for audio files
- **GraphQL API**: Direct Shopify Admin API integration

## Prerequisites

- Node.js 18.20 or 20.10+
- npm or yarn
- Shopify Partner account
- Cloudflare account with R2 access (for file storage)
- A development store (for testing)

## Environment Variables

Copy `.env.example` to `.env` and fill in your values:

```bash
# Shopify API credentials - Get from Shopify Partner Dashboard
SHOPIFY_API_KEY=your_api_key
SHOPIFY_API_SECRET=your_api_secret
SHOPIFY_APP_URL=https://producer-launchpad-app.fly.dev

# Session secret - Generate random string (32+ chars)
SESSION_SECRET=your_random_secret

# Cloudflare R2 credentials
CF_R2_ACCOUNT_ID=your-account-id
CF_R2_BUCKET_NAME=your-bucket-name
CF_R2_ACCESS_KEY_ID=your-access-key-id
CF_R2_SECRET_ACCESS_KEY=your-secret-access-key
CF_R2_PUBLIC_BASE_URL=https://your-public-files-domain.com
```

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Shopify App

1. Go to [Shopify Partner Dashboard](https://partners.shopify.com)
2. Create a new app
3. Copy the API key and secret to your `.env` file
4. Update `shopify.app.toml` with your app details

### 3. Configure Cloudflare R2

1. Create an R2 bucket in your Cloudflare account
2. Create an R2 access key with bucket access
3. Add the R2 credentials and public base URL to `.env`

### 4. Run Locally

```bash
# Development mode with hot reload
shopify app dev

# Or with npm
npm run dev
```

This will:
- Start the Remix development server
- Create a tunnel (using Cloudflare or ngrok)
- Update your app URLs in Shopify Partner Dashboard
- Open your development store with the app installed

### 5. Run Setup Wizard

1. Open the app in your development store
2. Navigate to "Setup" in the left sidebar
3. Click "Run Setup Wizard"
4. This creates all required metafields, metaobjects, and default licenses

## Project Structure

```
app/
├── app/
│   ├── components/        # React components
│   ├── routes/           # Remix routes
│   │   ├── app._index.tsx      # Main upload interface
│   │   ├── app.setup.tsx       # Auto-setup page
│   │   ├── app.beats.*.tsx     # Beat management
│   │   ├── app.licenses.tsx    # License management
│   │   ├── app.webhooks.tsx    # Shopify webhooks
│   │   └── auth.$.tsx          # OAuth handling
│   ├── services/         # Business logic
│   │   ├── shopify.ts         # GraphQL client
│   │   ├── metafieldSetup.ts  # Auto-setup logic
│   │   ├── r2.server.ts       # Cloudflare R2 helpers
│   │   └── productCreator.ts  # Product creation
│   ├── root.tsx          # App root with Polaris
│   ├── entry.client.tsx  # Client entry
│   ├── entry.server.tsx  # Server entry
│   └── shopify.server.ts # Shopify auth config
├── shopify.app.toml      # App configuration
├── package.json
└── tsconfig.json
```

## Key GraphQL Operations

### Metafield Definitions

```graphql
# Query existing definitions
query GetMetafieldDefinitions($ownerType: MetafieldOwnerType!) {
  metafieldDefinitions(first: 100, ownerType: $ownerType) {
    nodes { id name key namespace type { name } }
  }
}

# Create definition
mutation CreateMetafieldDefinition($definition: MetafieldDefinitionInput!) {
  metafieldDefinitionCreate(definition: $definition) {
    createdDefinition { id key namespace }
    userErrors { field message }
  }
}
```

### Product Creation

```graphql
mutation CreateProduct($input: ProductInput!) {
  productCreate(input: $input) {
    product { id title variants(first: 10) { edges { node { id price } } } }
    userErrors { field message }
  }
}
```

## Auto-Setup Details

The setup wizard automatically creates:

### Product Metafields
- `custom.bpm` (number_integer)
- `custom.key` (single_line_text_field)
- `custom.audio_preview` (url)
- `custom.cover_art` (url)
- `custom.genre` (metaobject_reference → genre)
- `custom.producer` (metaobject_reference → producer)
- `custom.producer_alias` (single_line_text_field)
- `custom.beat_licenses` (list.metaobject_reference → beat_license)
- `custom.untagged_mp3` (url)
- `custom.full_version_zip` (url)

### Variant Metafields
- `custom.license_reference` (metaobject_reference → beat_license)

### Metaobject Definitions
- `beat_license` - License tier definitions
- `producer` - Producer profiles
- `genre` - Genre classifications

### Default Licenses
- Basic License ($29.99) - MP3, 10K streams
- Premium License ($79.99) - MP3 + WAV, 100K streams
- Unlimited License ($149.99) - All formats, unlimited

## Deployment

### Deploy to Fly.io

Use the deployment guide in [docs/FLY_DEPLOYMENT.md](/Users/payan/.codex/worktrees/0468/producer-launchpad-app/docs/FLY_DEPLOYMENT.md).

Current production host:

```toml
application_url = "https://producer-launchpad-app.fly.dev"
```

### Environment Variables

Add these to your hosting platform:

- `SHOPIFY_API_KEY`
- `SHOPIFY_API_SECRET`
- `SHOPIFY_APP_URL`
- `SESSION_SECRET`
- `CF_R2_ACCOUNT_ID`
- `CF_R2_BUCKET_NAME`
- `CF_R2_ACCESS_KEY_ID`
- `CF_R2_SECRET_ACCESS_KEY`
- `CF_R2_PUBLIC_BASE_URL`

### Submit to Shopify App Store

1. Test thoroughly in development
2. Deploy to production
3. Go to Partner Dashboard → Apps → Your App
4. Complete the App Store listing
5. Submit for review

## Usage Flow

1. **Install App**: Producer installs app from Shopify App Store
2. **Auto-Setup**: Setup wizard runs automatically on first load
3. **Upload Beat**:
   - Fill in title, BPM, key, genre, producer
   - Drag-and-drop audio files
   - Set license prices
   - Click Upload
4. **Product Created**: Beat appears in store with all variants and metafields

## Troubleshooting

### Setup fails with "permission denied"
- Ensure your app has `write_products` and `write_metaobjects` scopes
- Check that the shop has granted all requested permissions

### File uploads fail
- Verify Cloudflare R2 credentials are correct
- Check the R2 bucket exists and is accessible
- Ensure file sizes are under limits (500MB max)

### Products created but not showing in theme
- Verify theme supports the Big Bang metafield schema
- Check that `beat_licenses` metafield is populated
- Ensure variants have `license_reference` metafields

## Success Criteria

✅ App runs locally with `shopify app dev`  
✅ Auto-setup creates all required metafields on first install  
✅ Producer can upload a beat with all metadata in <10 minutes  
✅ No manual Shopify configuration required  

## License

MIT
