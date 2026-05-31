#!/bin/bash

# Configuration - Update these or set them as environment variables
PROJECT_ID="photos-to-flickr-exporter"
REGION="us-central1"
SERVICE_NAME="google-photos-to-flickr"

echo "🚀 Starting deployment to Google Cloud Run..."

# 1. Build and Submit to Google Cloud Build
echo "📦 Building container image..."
gcloud builds submit --tag gcr.io/$PROJECT_ID/$SERVICE_NAME

# 2. Deploy to Cloud Run
echo "🌍 Deploying to Cloud Run..."
gcloud run deploy $SERVICE_NAME \
  --image gcr.io/$PROJECT_ID/$SERVICE_NAME \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --set-env-vars="NODE_ENV=production"

echo "✅ Deployment complete!"
