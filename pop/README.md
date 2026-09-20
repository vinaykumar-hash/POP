# POP (Parking on Phone) 🚗📱

> **Intelligent Urban Parking Availability Prediction & Peer-to-Peer Parking Marketplace**

[![Next.js](https://img.shields.io/badge/Next.js-16.3.5-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.0-61DAFB?style=for-the-badge&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![AWS DynamoDB](https://img.shields.io/badge/Amazon_DynamoDB-Serverless_NoSQL-4053D6?style=for-the-badge&logo=amazondynamodb)](https://aws.amazon.com/dynamodb/)
[![Amazon Cognito](https://img.shields.io/badge/Amazon_Cognito-Auth_%26_Identity-FF9900?style=for-the-badge&logo=amazoncognito)](https://aws.amazon.com/cognito/)
[![AWS Amplify](https://img.shields.io/badge/AWS_Amplify-Hosting_%26_CI%2FCD-FF9900?style=for-the-badge&logo=awsamplify)](https://aws.amazon.com/amplify/)

---

## 📌 Overview

**POP (Parking on Phone)** is a full-stack Next.js 16 application engineered with an enterprise-ready, dual-mode architecture:
1. **Live On-Street Parking Intelligence**: Crowd-sourced probabilistic spot prediction with turn-by-turn navigation.
2. **Private Rental Marketplace**: Discover, reserve, and unlock verified private parking spaces with instant digital gate passes.

For complete project documentation, see the [Root README](../README.md) and [Deployment Guide](./DEPLOYMENT_GUIDE.md).

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment (Optional)
The project includes automatic fallbacks so you can run it immediately without setting up AWS:
```bash
cp .env.example .env.local
```

### 3. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 4. Build for Production
```bash
npm run build
```

---

## 🌐 Main Routes

- `/`: Landing page
- `/find`: Street parking with live probability estimator
- `/find/rent`: Peer-to-peer private parking marketplace & booking
- `/host/new`: 5-step parking space onboarding wizard
- `/host/dashboard`: Host management portal (listings & bookings)
- `/admin/listings`: Admin verification dashboard

---

## 📄 License
MIT License
