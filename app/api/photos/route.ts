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
      const errorBody = await response.text();
      console.error('Google API Error Response:', errorBody);
      throw new Error(`Google API error: ${response.statusText} - ${errorBody}`);
    }

    const data = await response.json();
    // data should contain { id, pickerUri }
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error creating picker session:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
