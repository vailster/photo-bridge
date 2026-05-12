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
    const response = await fetch(`https://photospicker.googleapis.com/v1/mediaItems?sessionId=${sessionId}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token.accessToken}`,
      },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('Google API Error Response:', errorBody);
      throw new Error(`Google API error: ${response.statusText} - ${errorBody}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error fetching picker media items:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
