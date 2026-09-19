# POP (Parking on phone) — AWS Deployment & Database Guide

This guide walks you through deploying **POP** to **AWS Amplify Hosting** (Option A) and connecting the **AWS DynamoDB** database.

---

## Step 1: Provision DynamoDB, S3, & Cognito in One Click

We have provided an automated CloudFormation template [`infra/pop-cloudformation.yml`](./infra/pop-cloudformation.yml) that creates:
- **5 DynamoDB Tables**:
  - `POP-Locations-dev`: Open and public parking spaces in Bengaluru.
  - `POP-Events-dev`: Crowdsourced driver signals with 48h automated TTL.
  - `POP-Listings-dev`: Host private parking listings (with status, pricing, photos).
  - `POP-Hosts-dev`: Host profiles and verification documents.
  - `POP-Bookings-dev`: Reservations and bookings.
- **S3 Bucket (`pop-media-dev-{AccountId}`)**: Secure parking photo storage with CORS.
- **Cognito User Pool**: Authentication for Drivers, Hosts, and Admins.

### How to deploy via AWS Management Console:
1. Log into your [AWS Management Console](https://console.aws.amazon.com/).
2. Navigate to **CloudFormation** (make sure your region in top right is **ap-south-1** Mumbai).
3. Click **Create stack** -> **With new resources (standard)**.
4. Select **Upload a template file** -> Choose [`infra/pop-cloudformation.yml`](./infra/pop-cloudformation.yml).
5. Stack name: `pop-cloud-dev` -> Click **Next** -> Click **Next** -> Check the acknowledgment box -> Click **Submit**.
6. Wait ~2 minutes until status shows **CREATE_COMPLETE**.
7. Go to the **Outputs** tab of your stack. Note down:
   - `UserPoolId`
   - `UserPoolClientId`
   - `MediaBucketName`
   - Table names (`POP-Locations-dev`, `POP-Listings-dev`, etc.)

---

## Step 2: Seed DynamoDB Database

Once your tables are created, you can seed Bengaluru's parking spots and verified listings into DynamoDB:

```bash
# In your terminal inside pop/
npm run seed:dynamo
```
*(If running locally against real AWS, set `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` in `.env.local`).*

---

## Step 3: Deploy Frontend to AWS Amplify Hosting (Option A)

**AWS Amplify Hosting** natively supports Next.js 16 App Router (Server-Side Rendering, Server Components, Route Handlers, and static caching).

### Method 1: Git-Connected CI/CD (Recommended)
1. Push your repository to GitHub, GitLab, or AWS CodeCommit.
2. In the AWS Console, open **AWS Amplify**.
3. Click **Create new app** -> Select your Git provider -> Select repository and branch (`main`).
4. Amplify will automatically detect the [`amplify.yml`](./amplify.yml) build configuration.
5. In **Environment variables**, add:
   ```env
   NEXT_PUBLIC_AWS_REGION=ap-south-1
   AWS_REGION=ap-south-1
   DYNAMODB_TABLE_LOCATIONS=POP-Locations-dev
   DYNAMODB_TABLE_EVENTS=POP-Events-dev
   DYNAMODB_TABLE_LISTINGS=POP-Listings-dev
   DYNAMODB_TABLE_HOSTS=POP-Hosts-dev
   DYNAMODB_TABLE_BOOKINGS=POP-Bookings-dev
   NEXT_PUBLIC_COGNITO_USER_POOL_ID=<your-UserPoolId>
   NEXT_PUBLIC_COGNITO_CLIENT_ID=<your-UserPoolClientId>
   AWS_S3_MEDIA_BUCKET=<your-MediaBucketName>
   ```
6. (Optional: Grant DynamoDB permissions):
   - Under **App Settings** -> **General** -> **Service role**, attach a role with `AmazonDynamoDBFullAccess` and `AmazonS3FullAccess` so the Next.js API route handlers can read/write directly to DynamoDB without hardcoded credentials!
7. Click **Save and deploy**. Amplify will build and deploy your app to a live HTTPS URL (e.g. `https://main.d123abc.amplifyapp.com`).

---

## Step 4: Verify Deployment

1. Visit your live Amplify URL.
2. **Find Parking**: Check the map to see Bengaluru open parking spots.
3. **List Parking**: Open `/host/new`, complete the 6-step onboarding wizard, and submit your listing.
4. Open the DynamoDB console (`POP-Listings-dev`) — you will see your newly submitted listing stored in the cloud database!
