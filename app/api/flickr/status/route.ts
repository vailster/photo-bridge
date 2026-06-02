import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get('flickr_access_token')?.value;
  const username = cookieStore.get('flickr_username')?.value;

  return NextResponse.json({ 
    connected: !!token, 
    username: username || null 
  });
}
