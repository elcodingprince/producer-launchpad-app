// Example integration into app.beats.new.tsx
// Shows how to use the LicenseFileAssignment component

import { useState } from 'react';
import { json, redirect } from '@remix-run/node';
import { useLoaderData, useSubmit, useNavigation } from '@remix-run/react';
import {
  Page,
  Layout,
  Card,
  BlockStack,
  Button,
  Text,
} from '@shopify/polaris';
import { authenticate } from '../shopify.server';
import { LicenseFileAssignment } from '../components/LicenseFileAssignment';

export async function loader({ request }) {
  const { admin, session } = await authenticate.admin(request);
  
  // Fetch licenses from your database or Shopify metaobjects
  const licenses = await fetchLicenses(admin);
  
  return json({ licenses, shop: session.shop });
}

export async function action({ request }) {
  const { admin, session } = await authenticate.admin(request);
  const formData = await request.formData();
  
  const intent = formData.get('intent');
  
  if (intent === 'create-beat') {
    const beatData = JSON.parse(formData.get('beatData'));

    // Create the beat product with file assignments
    const result = await createBeatWithLicenseFiles({
      admin,
      shop: session.shop,
      beatData,
    });
    
    if (result.success) {
      return redirect(`/app/beats/${result.beatId}`);
    }
    
    return json({ error: result.error });
  }
  
  return json({ error: 'Unknown intent' });
}

export default function BeatUploadPage() {
  const { licenses } = useLoaderData();
  const submit = useSubmit();
  const navigation = useNavigation();
  
  const isSubmitting = navigation.state === 'submitting';
  
  // State to hold the complete beat data from LicenseFileAssignment
  const [beatData, setBeatData] = useState({
    title: '',
    bpm: '',
    key: 'C minor',
    genreGids: [],
    uploadedFiles: [],
    licenseFiles: {
      basic: [],
      premium: [],
      unlimited: [],
    },
  });

  const handleCreateBeat = () => {
    submit(
      {
        intent: 'create-beat',
        beatData: JSON.stringify(beatData),
      },
      { method: 'POST' }
    );
  };

  return (
    <Page
      title="Upload New Beat"
      backAction={{ content: 'Beats', url: '/app/beats' }}
    >
      <Layout>
        <Layout.Section>
          <BlockStack gap="500">
            {/* Step 1: Beat Details (your existing form) */}
            <Card>
              <BlockStack gap="400">
                <Text variant="headingMd" as="h2">
                  Beat Details
                </Text>
                {/* Your existing form fields for title, BPM, key, etc. */}
              </BlockStack>
            </Card>

            {/* Step 2: License File Assignment (new component) */}
            <LicenseFileAssignment
              licenses={licenses}
              onChange={(data) => setBeatData((prev) => ({ ...prev, ...data }))}
              value={beatData}
            />

            {/* Step 3: Submit */}
            <Card>
              <Button
                variant="primary"
                size="large"
                fullWidth
                loading={isSubmitting}
                onClick={handleCreateBeat}
                disabled={!beatData.licenseFiles?.basic?.length}
              >
                {isSubmitting ? 'Creating...' : 'Create Beat Product'}
              </Button>
            </Card>
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

// Helper function to create beat with license file assignments
async function createBeatWithLicenseFiles({ admin, shop, beatData }) {
  try {
    const { title, bpm, key, licenseFiles, uploadedFiles } = beatData;
    
    // Upload files to storage (R2/Bunny) first
    const uploadedUrls = await uploadFilesToStorage({
      shop,
      files: uploadedFiles,
    });
    
    // Create product with variants
    const product = await createShopifyProduct({
      admin,
      title,
      bpm,
      key,
      variants: [
        { title: 'Basic License', price: '29.99', files: licenseFiles.basic },
        { title: 'Premium License', price: '49.99', files: licenseFiles.premium },
        { title: 'Unlimited License', price: '99.99', files: licenseFiles.unlimited },
      ],
    });
    
    // Create file mappings in your database
    await saveLicenseFileMappings({
      beatId: product.id,
      licenseFiles,
      uploadedUrls,
    });
    
    return { success: true, beatId: product.id };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Database schema for license file mappings (Prisma example)
/*
model BeatFile {
  id          String   @id @default(cuid())
  beatId      String
  filename    String
  storageUrl  String
  fileType    String   // mp3, wav, stems, cover
  fileSize    Int
  createdAt   DateTime @default(now())
}

model LicenseFileMapping {
  id          String   @id @default(cuid())
  beatId      String
  licenseTier String   // basic, premium, unlimited
  fileId      String   // references BeatFile.id
  sortOrder   Int      @default(0)
}
*/
