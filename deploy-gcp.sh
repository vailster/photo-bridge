#!/bin/bash

# Configuration - Update these or set them as environment variables
PROJECT_ID="photos-to-flickr-exporter"
REGION="us-central1"
SERVICE_NAME="google-photos-to-flickr"
NEXTAUTH_URL="https://google-photos-to-flickr-50155018958.us-central1.run.app"

echo "🚀 Starting deployment to Google Cloud Run..."

# Set active project
gcloud config set project $PROJECT_ID

# 1. Enable required APIs pre-emptively
echo "🔑 Enabling required Google Cloud APIs (Cloud Build & Cloud Run)..."
echo "Note: If these APIs were just enabled, it may take 1-2 minutes for permissions to propagate. If you get a PERMISSION_DENIED error next, please wait a minute and rerun the script."
gcloud services enable cloudbuild.googleapis.com run.googleapis.com --project=$PROJECT_ID

# 2. Build and Submit to Google Cloud Build
echo "📦 Building container image..."
gcloud builds submit --tag gcr.io/$PROJECT_ID/$SERVICE_NAME

# 3. Deploy to Cloud Run
echo "🌍 Deploying to Cloud Run..."
gcloud run deploy $SERVICE_NAME \
  --image gcr.io/$PROJECT_ID/$SERVICE_NAME \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --set-env-vars="NODE_ENV=production,NEXTAUTH_URL=$NEXTAUTH_URL"


echo "✅ Deployment complete!"

