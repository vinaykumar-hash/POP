// =============================================================================
// ParkWise — POST /api/media/upload-url
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getPresignedUploadUrl, isS3Configured } from '@/services/storage/s3Client';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fileName, fileType, folder } = body;

    if (!fileName || !fileType) {
      return NextResponse.json(
        { error: 'Both "fileName" and "fileType" are required.' },
        { status: 400 }
      );
    }

    const result = await getPresignedUploadUrl(fileName, fileType, folder);

    return NextResponse.json({
      success: true,
      ...result,
      isAwsConfigured: isS3Configured(),
    });
  } catch (error: unknown) {
    console.error('Error generating upload URL:', error);
    const message = error instanceof Error ? error.message : 'Failed to generate upload URL';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
