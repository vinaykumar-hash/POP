# ParkWise — AWS Cloud Infrastructure Guide

This directory contains the Infrastructure-as-Code (IaC) specifications and deployment recipes for the **ParkWise** smart parking backend on Amazon Web Services (AWS).

---

## Architecture Overview

The cloud backend is designed around serverless and managed primitives:

1. **AWS Cognito User Pool & Client**:
   - Manages user identity, SRP authentication, and token issuance.
   - User Groups: `Drivers`, `Hosts` (Rent Parking marketplace), and `Admins`.
2. **AWS S3 Bucket (`parkwise-media-dev-${AWS::AccountId}`)**:
   - Secure storage for parking facility photos, entrance images, and host property verification documents.
   - Authorized direct-to-S3 uploads via presigned PUT URLs (`services/storage/s3Client.ts`).
3. **AWS DynamoDB (Pay-Per-Request)**:
   - `ParkWise-Locations`: Spatial parking registry with Global Secondary Indexes (`BySourceIndex`, `ByTypeIndex`).
   - `ParkWise-Events`: Crowdsourced driver signals with automated 48-hour Time-To-Live (TTL).
   - `ParkWise-Bookings`: Reservation and rental contracts supporting the upcoming Rent Parking module.
4. **AWS API Gateway v2 (HTTP API)**:
   - Modern, low-latency API gateway routing requests to decoupled Lambda micro-functions.
   - Protected by Cognito JWT Authorizer.
5. **Decoupled AWS Lambda Micro-Functions (`serverless/handlers/`)**:
   - `searchParking`: Proximity search with Haversine filtering, vehicle type, and facility matching.
   - `getParkingDetails`: Fetch individual parking record with recent historical events.
   - `reportParkingEvent`: Ingests driver events and dynamically recalculates real-time availability.
   - `getUploadUrl`: Issues authenticated presigned S3 URLs for photo uploads.

---

## Deploying to AWS

### Prerequisites
- [AWS CLI v2](https://aws.amazon.com/cli/) installed and configured with `aws configure`.
- IAM permissions to create CloudFormation stacks, DynamoDB tables, S3 buckets, Cognito User Pools, and Lambda functions.

### One-Command Deployment

Run the following command from the `pop/` root directory:

```bash
aws cloudformation deploy \
  --template-file infra/parkwise-cloudformation.yml \
  --stack-name parkwise-backend-dev \
  --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM \
  --parameter-overrides Environment=dev \
  --region ap-south-1
```

### Retrieving Output Configuration

After stack creation completes, query the generated resource identifiers:

```bash
aws cloudformation describe-stacks \
  --stack-name parkwise-backend-dev \
  --region ap-south-1 \
  --query "Stacks[0].Outputs" \
  --output table
```

Copy the output values (`UserPoolId`, `UserPoolClientId`, `MediaBucketName`, `HttpApiUrl`) into your `.env.local` file:

```env
NEXT_PUBLIC_AWS_REGION=ap-south-1
NEXT_PUBLIC_COGNITO_USER_POOL_ID=<UserPoolId>
NEXT_PUBLIC_COGNITO_CLIENT_ID=<UserPoolClientId>
AWS_S3_MEDIA_BUCKET=<MediaBucketName>
```

---

## Local Development (Zero AWS Configuration Required)

ParkWise is architected with a **Local-First** philosophy. If AWS credentials or variables are not provided in `.env.local`, the application seamlessly switches to built-in local emulation:
- **Authentication**: Local mock sessions with instant 1-click test roles (Arjun Reddy as Driver, Priya Sharma as Host).
- **Storage**: Local mock presigned URLs.
- **Database**: In-memory repository seeded with 88 OpenCity Bengaluru parking facilities.
