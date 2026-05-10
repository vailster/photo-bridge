import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import oauth from '@/lib/flickr-oauth';

export async function POST(req: NextRequest) {
  try {
    const { photos } = await req.json();
    if (!photos || photos.length === 0) {
      return NextResponse.json({ error: 'No photos provided' }, { status: 400 });
    }

    const cookieStore = await cookies();
    const access_token = cookieStore.get('flickr_access_token')?.value;
    const access_token_secret = cookieStore.get('flickr_access_token_secret')?.value;

    if (!access_token || !access_token_secret) {
      return NextResponse.json({ error: 'Flickr not authenticated' }, { status: 401 });
    }

    let uploadedCount = 0;

    for (const photo of photos) {
      // 1. Download the high-res image from Google Photos
      // For Picker API, it's photo.mediaFile.baseUrl
      const baseUrl = photo.mediaFile ? photo.mediaFile.baseUrl : photo.baseUrl;
      const filename = photo.mediaFile ? photo.mediaFile.filename : photo.filename;
      
      const photoRes = await fetch(`${baseUrl}=d`);
      if (!photoRes.ok || !photoRes.body) {
        console.error(`Failed to fetch photo ${photo.id} from Google`);
        continue;
      }
      
      const buffer = await photoRes.arrayBuffer();

      // 2. Upload to Flickr using multi-part form
      const uploadUrl = 'https://up.flickr.com/services/upload/';
      
      const request_data = {
        url: uploadUrl,
        method: 'POST',
        data: {
          title: filename,
        }
      };

      const authorized = oauth.authorize(request_data, {
        key: access_token,
        secret: access_token_secret
      });

      const formData = new FormData();
      // append auth params
      Object.keys(authorized).forEach((key) => {
        formData.append(key, authorized[key]);
      });
      // append the photo
      formData.append('photo', new Blob([buffer]), filename);

      const flickrRes = await fetch(uploadUrl, {
        method: 'POST',
        body: formData,
      });

      const xmlText = await flickrRes.text();
      if (xmlText.includes('<photoid>')) {
        uploadedCount++;
      } else {
        console.error('Flickr upload error:', xmlText);
      }
    }

    return NextResponse.json({ uploaded: uploadedCount, total: photos.length });

  } catch (error: any) {
    console.error('Upload handler error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
