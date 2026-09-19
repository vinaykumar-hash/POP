/**
 * AWS Lambda Handler: Get S3 Media Upload Presigned URL
 * Route: POST /media/upload-url
 * 
 * Generates an authorized AWS S3 presigned PUT URL enabling direct browser upload
 * of parking images or host verification documentation.
 */

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

interface APIGatewayEvent {
  body?: string | null;
  requestContext?: {
    authorizer?: {
      jwt?: {
        claims?: {
          sub?: string;
        };
      };
    };
  };
}

const s3 = new S3Client({
  region: process.env.AWS_REGION || 'ap-south-1',
});

const BUCKET_NAME = process.env.MEDIA_BUCKET || 'parkwise-media-dev';

export const handler = async (event: APIGatewayEvent) => {
  if (!event.body) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'Missing request body' }),
    };
  }

  let body: {
    fileName: string;
    fileType: string;
    folder?: string;
  };

  try {
    body = JSON.parse(event.body);
  } catch {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'Invalid JSON payload' }),
    };
  }

  const { fileName, fileType, folder = 'parking-photos' } = body;
  if (!fileName || !fileType) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: '"fileName" and "fileType" are required.' }),
    };
  }

  // Sanitize filename and create unique S3 key
  const safeName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
  const key = `${folder}/${Date.now()}-${safeName}`;

  try {
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      ContentType: fileType,
    });

    // 15-minute expiration
    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 900 });
    const publicUrl = `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION || 'ap-south-1'}.amazonaws.com/${key}`;

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        uploadUrl,
        key,
        publicUrl,
        expiresInSeconds: 900,
      }),
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: message }),
    };
  }
};
