# Google Cloud Platform Deployment Guide

This document outlines the steps to deploy the Google Photos to Flickr Exporter to **Google Cloud Run**.

## 🏗️ Deployment Strategy
We use **Next.js Standalone Mode** with a multi-stage Docker build to ensure the smallest possible container footprint and fastest startup times.

## 🚀 Quick Deploy

1. Ensure you have the [Google Cloud SDK](https://cloud.google.com/sdk/docs/install) installed and authenticated:
   ```bash
   gcloud auth login
   gcloud config set project photos-to-flickr-exporter
   ```

2. Make the deployment script executable (if not already):
   ```bash
   chmod +x deploy-gcp.sh
   ```

3. Run the deployment script:
   ```bash
   ./deploy-gcp.sh
   ```

## 🔐 Post-Deployment Configuration

### 1. IAM Permissions (Required for Secrets)
The application fetches credentials from Google Secret Manager. You must grant the Cloud Run service account permission to access them:
1. Go to the **IAM & Admin** page in the Google Cloud Console.
2. Find the service account used by your Cloud Run service (usually the `Default Compute Service Account` or one specifically created for the service).
3. Add the **Secret Manager Secret Accessor** role to this account.

### 2. Environment Variables
In the Cloud Run service configuration (under "Variables & Secrets"), add the following:
- `NEXTAUTH_URL`: The full URL of your deployed service (e.g., `https://google-photos-to-flickr-abc.a.run.app`).
- `NEXTAUTH_SECRET`: A long, random string used to encrypt session tokens.
- `PROJECT_ID`: `photos-to-flickr-exporter` (optional, falls back to internal GCP metadata).

### 3. OAuth Redirect URIs
Update your API provider settings to allow the production domain:

#### Google Cloud Console (APIs & Services > Credentials)
- **Authorized Redirect URIs**: `https://<YOUR-APP-URL>/api/auth/callback/google`

#### Flickr Developer Portal
- **Callback URL**: `https://<YOUR-APP-URL>/api/flickr/callback`

## 🛠️ Maintenance & Troubleshooting

### Updating the App
To push an update, simply re-run `./deploy-gcp.sh`. Cloud Build will handle the containerization and Cloud Run will perform a zero-downtime rolling update.

### Viewing Logs
You can view application logs directly in the Cloud Run console under the "Logs" tab or via the CLI:
```bash
gcloud logs read --service google-photos-to-flickr
```

### Local Testing with Docker
To test the production container locally:
```bash
docker build -t photos-to-flickr .
docker run -p 3000:3000 photos-to-flickr
```
