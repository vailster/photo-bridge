# PhotoBridge

A modern web application built with Next.js to seamlessly export your Google Photos directly to your Flickr photostream.

## 🚀 Features

- **Google Photos Picker Integration:** Securely browse and select photos using the official Google Photos Picker API.
- **Flickr OAuth Integration:** Simple authentication flow to connect your Flickr account.
- **Fault-Tolerant Client-Side Queue:** Uploads photos concurrently (concurrency limit of 2) with a beautiful glowing progress bar, displaying real-time statistics (transferred count, remaining items, current filename, and errors). 
- **Retry Mechanisms:** If any uploads fail due to transient network issues, PhotoBridge isolates them and provides a one-click "Retry Failed" action to re-run only those files.
- **Auto Re-authentication:** Automatically detects Google OAuth token expiration (401 status) during session checks, photo polling, or transfers, alerting the user and redirecting them to Google login after 1.5 seconds.
- **Memory Efficient:** Optimized for performance with singleton patterns for cloud service clients and robust cleanup of background polling, popup windows, and streams.
- **Type Safe:** Fully typed with TypeScript, ensuring reliability and maintainability.
- **Native Security:** Uses Node.js native `crypto` module for high-performance OAuth signing.

## 🛠️ Tech Stack

- **Framework:** Next.js 16 (App Router)
- **UI:** React 19, Tailwind CSS, Framer Motion
- **Icons:** React Icons (FaGoogle, FaFlickr)
- **Authentication:** Next-Auth (Google) + Custom Flickr OAuth 1.0a
- **Cloud Services:** Google Secret Manager (for secure credential storage)
- **Infrastructure:** Docker, Google Cloud Run, Google Cloud Build

## 📋 Prerequisites

Before running the application, ensure you have the following credentials:

### Google Cloud Platform
- Google Client ID & Secret (with Photos Picker API enabled)
- A GCP project with Secret Manager API enabled

### Flickr
- Flickr API Key & Secret

## ⚙️ Environment Variables

Create a `.env.local` file or add these to your environment:

```env
# Google Authentication
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# Flickr Authentication
FLICKR_API_KEY=your_flickr_key
FLICKR_API_SECRET=your_flickr_secret

# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your_nextauth_secret
```

*Note: In production, these secrets are fetched from Google Secret Manager using the `FLICKR_API_KEY`, `FLICKR_API_SECRET`, etc. names.*

## 🚀 Getting Started

First, install the dependencies:

```bash
npm install
```

Then, run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## 🚢 Deployment

This project is optimized for deployment to **Google Cloud Run** using Docker and Next.js standalone mode.

- **GCP Deployment Guide:** See [GCP_DEPLOYMENT.md](./GCP_DEPLOYMENT.md) for step-by-step instructions.
- **Quick Deploy Script:** Use `./deploy-gcp.sh` to build and deploy to your GCP project.

## 🏗️ Architecture Notes

- **Asset Serving in Standalone Mode:** The local build script automatically handles copying the assets (`public` and `.next/static`) into the standalone directory, ensuring seamless local production runs.
- **Secret Management:** The app uses a singleton pattern for the `SecretManagerServiceClient` to prevent connection leakage during development.
- **Polling Logic:** The picker polling mechanism includes strict cancellation checks to prevent memory leaks and "zombie" background tasks.
- **Popup Management:** Integrated cleanup logic ensures that OAuth/Picker popups are closed when the main application unmounts.
