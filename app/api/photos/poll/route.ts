import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { getSecret } from '@/lib/secrets';

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get('sessionId');
  
  if (!sessionId) {
    return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });
  }

  const token = await getToken({ req, secret: await getSecret("NEXTAUTH_SECRET") });
  
  if (!token || !token.accessToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 1. Check if picking is done via sessions.get
    const sessionRes = await fetch(`https://photospicker.googleapis.com/v1/sessions/${sessionId}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token.accessToken}`,
      },
    });

    if (!sessionRes.ok) {
      let errorBody = '';
      try {
        errorBody = await sessionRes.text();
      } catch {
        if (sessionRes.body) {
          try {
            await sessionRes.body.cancel();
          } catch {}
        }
      }
      console.error('Google Session API Error:', errorBody);
      if (sessionRes.status === 401) {
        return NextResponse.json({ 
          error: 'Your Google connection has expired. Please sign out (Disconnect Google) and connect again to refresh your credentials.' 
        }, { status: 401 });
      }
      throw new Error(`Google API error checking session: ${sessionRes.statusText} - ${errorBody}`);
    }

    let sessionData;
    try {
      sessionData = await sessionRes.json();
    } catch (e) {
      if (sessionRes.body) {
        try {
          await sessionRes.body.cancel();
        } catch {}
      }
      throw e;
    }
    
    // If user hasn't finished picking yet
    if (!sessionData.mediaItemsSet) {
      return NextResponse.json({ status: 'picking' }, { status: 202 });
    }

    // 2. Selection complete, now fetch all the media items (handling pagination)
    let allMediaItems: any[] = [];
    let nextPageToken: string | null = null;
    let pageCount = 0;

    do {
      let url = `https://photospicker.googleapis.com/v1/mediaItems?sessionId=${sessionId}&pageSize=100`;
      if (nextPageToken) {
        url += `&pageToken=${encodeURIComponent(nextPageToken)}`;
      }

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token.accessToken}`,
        },
      });

      if (!response.ok) {
        let errorBody = '';
        try {
          errorBody = await response.text();
        } catch {
          if (response.body) {
            try {
              await response.body.cancel();
            } catch {}
          }
        }
        console.error('Google MediaItems API Error:', errorBody);
        if (response.status === 401) {
          return NextResponse.json({ 
            error: 'Your Google connection has expired. Please sign out (Disconnect Google) and connect again to refresh your credentials.' 
          }, { status: 401 });
        }
        throw new Error(`Google API error fetching items: ${response.statusText} - ${errorBody}`);
      }

      let data;
      try {
        data = await response.json();
      } catch (e) {
        if (response.body) {
          try {
            await response.body.cancel();
          } catch {}
        }
        throw e;
      }

      if (data.mediaItems && data.mediaItems.length > 0) {
        allMediaItems = allMediaItems.concat(data.mediaItems);
      }

      nextPageToken = data.nextPageToken || null;
      pageCount++;

      // Safety limit to prevent infinite loops (max 50 pages = 5,000 photos)
      if (pageCount > 50) {
        break;
      }
    } while (nextPageToken);

    return NextResponse.json({ mediaItems: allMediaItems });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in picker poll:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
