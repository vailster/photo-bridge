import { NextResponse } from 'next/server';
import { getFlickrOAuth } from '@/lib/flickr-oauth';
import { cookies } from 'next/headers';

export async function GET() {
  const request_data = {
    url: 'https://www.flickr.com/services/oauth/request_token',
    method: 'GET',
    data: {
      oauth_callback: `${process.env.NEXTAUTH_URL}/api/flickr/callback`,
    },
  };

  const oauth = await getFlickrOAuth();
  const url = new URL(request_data.url);
  const authorized = oauth.authorize(request_data);
  Object.keys(authorized).forEach((key) => url.searchParams.append(key, (authorized as any)[key]));

  try {
    const response = await fetch(url.toString());
    const data = await response.text();
    const params = new URLSearchParams(data);
    
    const oauth_token = params.get('oauth_token');
    const oauth_token_secret = params.get('oauth_token_secret');

    if (!oauth_token || !oauth_token_secret) {
      return NextResponse.json({ error: 'Failed to get request token' }, { status: 500 });
    }

    // Store the token secret in a cookie to verify it later in the callback
    const cookieStore = await cookies();
    cookieStore.set('flickr_request_token_secret', oauth_token_secret, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 10, // 10 minutes
      path: '/',
    });

    // Redirect user to Flickr authorization page
    const authUrl = `https://www.flickr.com/services/oauth/authorize?oauth_token=${oauth_token}&perms=write`;
    return NextResponse.redirect(authUrl);

  } catch (error) {
    console.error('Error getting request token', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
