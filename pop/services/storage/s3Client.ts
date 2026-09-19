// =============================================================================
// ParkWise — AWS S3 Storage Service
// =============================================================================

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const AWS_REGION = process.env.AWS_REGION || 'ap-south-1';
const BUCKET_NAME = process.env.AWS_S3_MEDIA_BUCKET || process.env.MEDIA_BUCKET || '';

const hasS3Config = Boolean(
  BUCKET_NAME &&
  (process.env.AWS_ACCESS_KEY_ID || process.env.AWS_PROFILE || process.env.AWS_EXECUTION_ENV)
);

let s3Client: S3Client | null = null;
if (hasS3Config) {
  try {
    s3Client = new S3Client({
      region: AWS_REGION,
      credentials:
        process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
          ? {
              accessKeyId: process.env.AWS_ACCESS_KEY_ID,
              secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
            }
          : undefined,
    });
  } catch (err) {
    console.warn('[ParkWise S3] Could not initialize AWS S3 client, using local mock fallback:', err);
  }
}

export interface PresignedUploadResponse {
  uploadUrl: string;
  key: string;
  publicUrl: string;
  expiresInSeconds: number;
  provider: 'aws-s3' | 'local-mock';
}

/**
 * Generates an authorized presigned PUT URL for uploading parking media to S3.
 * Falls back to a simulated local mock response if AWS S3 is unconfigured.
 */
export async function getPresignedUploadUrl(
  fileName: string,
  fileType: string,
  folder: string = 'parking-photos'
): Promise<PresignedUploadResponse> {
  const safeName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
  const key = `${folder}/${Date.now()}-${safeName}`;

  if (s3Client && BUCKET_NAME) {
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      ContentType: fileType,
    });

    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 900 });
    const publicUrl = `https://${BUCKET_NAME}.s3.${AWS_REGION}.amazonaws.com/${key}`;

    return {
      uploadUrl,
      key,
      publicUrl,
      expiresInSeconds: 900,
      provider: 'aws-s3',
    };
  }

  // Graceful local development fallback
  const mockUploadUrl = `/api/media/mock-upload?key=${encodeURIComponent(key)}`;
  const mockPublicUrl = `/images/parking-placeholder.jpg`;

  return {
    uploadUrl: mockUploadUrl,
    key,
    publicUrl: mockPublicUrl,
    expiresInSeconds: 900,
    provider: 'local-mock',
  };
}

export function isS3Configured(): boolean {
  return hasS3Config && s3Client !== null;
}
