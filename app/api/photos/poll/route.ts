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
      const errorBody = await sessionRes.text();
      console.error('Google Session API Error:', errorBody);
      throw new Error(`Google API error checking session: ${sessionRes.statusText} - ${errorBody}`);
    }

    const sessionData = await sessionRes.json();
    
    // If user hasn't finished picking yet
    if (!sessionData.mediaItemsSet) {
      return NextResponse.json({ status: 'picking' }, { status: 202 });
    }

    // 2. Selection complete, now fetch the media items
    const response = await fetch(`https://photospicker.googleapis.com/v1/mediaItems?sessionId=${sessionId}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token.accessToken}`,
      },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('Google MediaItems API Error:', errorBody);
      throw new Error(`Google API error fetching items: ${response.statusText} - ${errorBody}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in picker poll:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
