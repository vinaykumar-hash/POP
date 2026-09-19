import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { fileName, fileType } = body;
  
  // Generate a mock presigned URL (in production, this would be a real S3 presigned URL)
  const mockKey = `uploads/${Date.now()}_${fileName}`;
  const mockUrl = `https://pop-parking-bucket.s3.ap-south-1.amazonaws.com/${mockKey}?X-Amz-Algorithm=mock`;
  
  return NextResponse.json({
    uploadUrl: mockUrl,
    key: mockKey,
    contentType: fileType,
    expiresIn: 3600,
  });
}
