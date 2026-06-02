import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getToken } from 'next-auth/jwt';
import { getSecret } from '@/lib/secrets';
import { getFlickrOAuth } from '@/lib/flickr-oauth';
import { GoogleMediaItem } from '@/types/photos';

const CONCURRENCY_LIMIT = 3;

export async function POST(req: NextRequest) {
  try {
    const { photos }: { photos: GoogleMediaItem[] } = await req.json();
    if (!photos || photos.length === 0) {
      return NextResponse.json({ error: 'No photos provided' }, { status: 400 });
    }

    const token = await getToken({ req, secret: await getSecret("NEXTAUTH_SECRET") });
    if (!token || !token.accessToken) {
      return NextResponse.json({ error: 'Unauthorized (Google)' }, { status: 401 });
    }
    const googleAccessToken = token.accessToken as string;

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
      const startTime = Date.now();
      try {
        console.log(`[Upload] Starting transfer for: ${filename}`);
        // 1. Download from Google
        const baseUrl = photo.mediaFile ? photo.mediaFile.baseUrl : photo.baseUrl;
        
        // SSRF Mitigation: Validate that the URL is a trusted Google Photos media host
        const parsedUrl = new URL(baseUrl);
        if (parsedUrl.hostname !== 'googleusercontent.com' && !parsedUrl.hostname.endsWith('.googleusercontent.com')) {
          throw new Error(`Forbidden media URL host: ${parsedUrl.hostname}`);
        }

        const photoRes = await fetch(`${baseUrl}=d`, {
          headers: {
            Authorization: `Bearer ${googleAccessToken}`,
          },
        });
        
        if (!photoRes.ok || !photoRes.body) {
          if (photoRes.body) {
            try {
              await photoRes.body.cancel();
            } catch {}
          }
          throw new Error(`Google fetch failed: ${photoRes.statusText}`);
        }
        
        let buffer;
        try {
          buffer = await photoRes.arrayBuffer();
        } catch (err) {
          if (photoRes.body) {
            try {
              await photoRes.body.cancel();
            } catch {}
          }
          throw err;
        }

        console.log(`[Upload] Downloaded ${filename} (${buffer.byteLength} bytes) from Google in ${((Date.now() - startTime) / 1000).toFixed(2)}s`);

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
        }) as unknown as Record<string, string>;

        const formData = new FormData();
        Object.keys(authorized).forEach((key) => {
          formData.append(key, authorized[key]);
        });
        formData.append('photo', new Blob([buffer]), filename);

        const flickrUploadStart = Date.now();
        const flickrRes = await fetch(uploadUrl, {
          method: 'POST',
          body: formData,
        });

        let xmlText = '';
        try {
          xmlText = await flickrRes.text();
        } catch (err) {
          if (flickrRes.body) {
            try {
              await flickrRes.body.cancel();
            } catch {}
          }
          throw err;
        }

        if (xmlText.includes('<photoid>')) {
          uploadedCount++;
          console.log(`[Upload] Successfully uploaded ${filename} to Flickr in ${((Date.now() - flickrUploadStart) / 1000).toFixed(2)}s. Total time: ${((Date.now() - startTime) / 1000).toFixed(2)}s`);
        } else {
          console.error(`[Upload] Flickr upload error for ${filename}:`, xmlText);
          failed.push(filename);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        console.error(`[Upload] Task failed for ${filename}:`, message);
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
