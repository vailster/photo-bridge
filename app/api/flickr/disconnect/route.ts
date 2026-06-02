import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST() {
  const cookieStore = await cookies();
  cookieStore.delete('flickr_access_token');
  cookieStore.delete('flickr_access_token_secret');
  cookieStore.delete('flickr_username');
  return NextResponse.json({ success: true });
}
