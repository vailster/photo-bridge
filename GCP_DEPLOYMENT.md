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

### 4. Google OAuth Consent Screen Setup
For personal or private use, it is highly recommended to keep your GCP OAuth Consent Screen in **Testing** mode instead of publishing it to production (public):
* **No Verification Overhead**: You do not need to submit the app to Google for review, set up domain verification, or configure a public privacy policy.
* **No Warning Screens**: Users added as Test Users can log in directly without seeing any "Unverified App" warning screens.
* **Configuration Steps**:
  1. Go to the **OAuth consent screen** page in your Google Cloud Console.
  2. Ensure the publishing status is set to **Testing** (if it is set to "In Production", click **Back to testing**).
  3. Under the **Test users** section, click **Add Users** and input your Google account email(s).
  4. Click **Save**.


## 🛠️ Maintenance & Troubleshooting

### Updating the App
To push an update, simply re-run `./deploy-gcp.sh`. Cloud Build will handle the containerization and Cloud Run will perform a zero-downtime rolling update.

### Viewing Logs
You can view application logs directly in the Cloud Run console under the "Logs" tab or via the CLI:
```bash
gcloud logs read --service google-photos-to-flickr
```

### Common Errors & Solutions

#### 1. `PERMISSION_DENIED: The caller does not have permission` during Cloud Build
* **Cause**: This usually happens if the Cloud Build API (`cloudbuild.googleapis.com`) was just enabled. Google Cloud takes a couple of minutes to propagate permissions and finalize API registration.
* **Solution**: Wait 1–2 minutes and re-run `./deploy-gcp.sh`.

#### 2. `Error fetching secret ... from GSM` (at runtime)
* **Cause**: The Cloud Run service account does not have permission to access secrets in Google Secret Manager, or the secrets are not yet created in the project.
* **Solution**: 
  1. Grant the **Secret Manager Secret Accessor** role (`roles/secretmanager.secretAccessor`) to the Cloud Run service account (usually the `Default Compute Service Account` unless customized).
  2. Verify that the secrets (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `FLICKR_API_KEY`, `FLICKR_API_SECRET`, and `NEXTAUTH_SECRET`) exist in the **Secret Manager** page in the GCP Console under the exact names used by your app.

### Local Testing with Docker
To test the production container locally:
```bash
docker build -t photos-to-flickr .
docker run -p 3000:3000 photos-to-flickr
```

