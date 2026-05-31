import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getFlickrOAuth } from '@/lib/flickr-oauth';
import { GoogleMediaItem } from '@/types/photos';

const CONCURRENCY_LIMIT = 3;

export async function POST(req: NextRequest) {
  try {
    const { photos }: { photos: GoogleMediaItem[] } = await req.json();
    if (!photos || photos.length === 0) {
      return NextResponse.json({ error: 'No photos provided' }, { status: 400 });
    }

    const cookieStore = await cookies();
    const access_token = cookieStore.get('flickr_access_token')?.value;
    const access_token_secret = cookieStore.get('flickr_access_token_secret')?.value;

    if (!access_token || !access_token_secret) {
      return NextResponse.json({ error: 'Flickr not authenticated' }, { status: 401 });
    }

    const oauth = await getFlickrOAuth();
    const failed: string[] = [];
    let uploadedCount = 0;

    // Helper to upload a single photo
    const uploadPhoto = async (photo: GoogleMediaItem) => {
      const filename = photo.mediaFile ? photo.mediaFile.filename : photo.filename;
      try {
        // 1. Download from Google
        const baseUrl = photo.mediaFile ? photo.mediaFile.baseUrl : photo.baseUrl;
        const photoRes = await fetch(`${baseUrl}=d`);
        
        if (!photoRes.ok || !photoRes.body) {
          throw new Error(`Google fetch failed: ${photoRes.statusText}`);
        }
        
        const buffer = await photoRes.arrayBuffer();

        // 2. Upload to Flickr
        const uploadUrl = 'https://up.flickr.com/services/upload/';
        const request_data = {
          url: uploadUrl,
          method: 'POST',
          data: { title: filename }
        };

        const authorized = oauth.authorize(request_data, {
          key: access_token,
          secret: access_token_secret
        }) as Record<string, string>;

        const formData = new FormData();
        Object.keys(authorized).forEach((key) => {
          formData.append(key, authorized[key]);
        });
        formData.append('photo', new Blob([buffer]), filename);

        const flickrRes = await fetch(uploadUrl, {
          method: 'POST',
          body: formData,
        });

        const xmlText = await flickrRes.text();
        if (xmlText.includes('<photoid>')) {
          uploadedCount++;
        } else {
          console.error(`Flickr upload error for ${filename}:`, xmlText);
          failed.push(filename);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        console.error(`Upload task failed for ${filename}:`, message);
        failed.push(filename);
      }
    };

    // Process in chunks to maintain concurrency limit
    for (let i = 0; i < photos.length; i += CONCURRENCY_LIMIT) {
      const chunk = photos.slice(i, i + CONCURRENCY_LIMIT);
      await Promise.all(chunk.map(uploadPhoto));
    }

    return NextResponse.json({ 
      uploaded: uploadedCount, 
      total: photos.length,
      failed 
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Upload handler error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
