# Producer Launchpad - Shopify Embedded App

A Shopify Embedded App built with Remix that allows music producers to upload beats with automatic metafield configuration. No manual Shopify setup required.

## Features

- **Auto-Setup on Install**: Automatically creates all required metafield definitions, metaobject definitions, and default licenses
- **Drag-and-Drop Upload**: Easy file upload for MP3 previews, WAV files, stems ZIP, and cover art
- **License Management**: Create and manage beat licensing tiers (Basic, Premium, Unlimited)
- **Polaris UI**: Native Shopify Admin interface using Polaris design system
- **BunnyCDN Integration**: Fast file storage and delivery for audio files
- **GraphQL API**: Direct Shopify Admin API integration

## Prerequisites

- Node.js 18.20 or 20.10+
- npm or yarn
- Shopify Partner account
- BunnyCDN account (for file storage)
- A development store (for testing)

## Environment Variables

Copy `.env.example` to `.env` and fill in your values:

```bash
# Shopify API credentials - Get from Shopify Partner Dashboard
SHOPIFY_API_KEY=your_api_key
SHOPIFY_API_SECRET=your_api_secret
SHOPIFY_APP_URL=https://your-app-url.com

# Session secret - Generate random string (32+ chars)
SESSION_SECRET=your_random_secret

# BunnyCDN credentials - Get from BunnyCDN dashboard
BUNNY_STORAGE_ZONE=your-zone
BUNNY_STORAGE_PASSWORD=your-password
BUNNY_PULL_ZONE=your-zone.b-cdn.net
BUNNY_REGION=ny
```

## Setup Instructions

### 1. Install Dependencies

```bash
cd builds/solution_002/app
npm install
```

### 2. Configure Shopify App

1. Go to [Shopify Partner Dashboard](https://partners.shopify.com)
2. Create a new app
3. Copy the API key and secret to your `.env` file
4. Update `shopify.app.toml` with your app details

### 3. Configure BunnyCDN

1. Create a storage zone at [BunnyCDN](https://bunny.net)
2. Create a pull zone linked to your storage
3. Copy the storage password and zone names to `.env`

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
│   │   ├── bunnyCdn.ts        # File upload service
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

### Deploy to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

Update `shopify.app.toml` with your production URL:

```toml
application_url = "https://your-app.vercel.app"
```

### Environment Variables

Add these to your hosting platform:

- `SHOPIFY_API_KEY`
- `SHOPIFY_API_SECRET`
- `SHOPIFY_APP_URL`
- `SESSION_SECRET`
- `BUNNY_STORAGE_ZONE`
- `BUNNY_STORAGE_PASSWORD`
- `BUNNY_PULL_ZONE`
- `BUNNY_REGION`

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
- Verify BunnyCDN credentials are correct
- Check storage zone exists and is accessible
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
