import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { getSecret } from '@/lib/secrets';

export async function POST(req: NextRequest) {
  const token = await getToken({ req, secret: await getSecret("NEXTAUTH_SECRET") });
  
  if (!token || !token.accessToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const response = await fetch('https://photospicker.googleapis.com/v1/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
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
      console.error('Google API Error Response:', errorBody);
      if (response.status === 401) {
        return NextResponse.json({ 
          error: 'Your Google connection has expired. Please sign out (Disconnect Google) and connect again to refresh your credentials.' 
        }, { status: 401 });
      }
      throw new Error(`Google API error: ${response.statusText} - ${errorBody}`);
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
    // data should contain { id, pickerUri }
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error creating picker session:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
