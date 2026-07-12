import { NextRequest, NextResponse } from 'next/server';
import { getFlickrOAuth } from '@/lib/flickr-oauth';
import { cookies } from 'next/headers';

export async function GET(req: NextRequest) {
  const isSecure = req.nextUrl.protocol === 'https:' || req.headers.get('x-forwarded-proto') === 'https';
  
  // Dynamically determine the callback URL based on the request headers so that it works
  // when accessing the app from different devices on a local network (e.g. using the server's IP address).
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || req.nextUrl.host;
  const protocol = isSecure ? 'https' : 'http';
  let callbackUrl = `${protocol}://${host}/api/flickr/callback`;

  // If NEXTAUTH_URL is set and is a production/external URL, we prefer to use it.
  // Otherwise, we default to the dynamic URL to prevent redirection errors like 0.0.0.0 or localhost.
  if (process.env.NEXTAUTH_URL) {
    try {
      const configuredUrl = new URL(process.env.NEXTAUTH_URL);
      const isLocalhostOrZero = configuredUrl.hostname === 'localhost' || 
                                configuredUrl.hostname === '0.0.0.0' || 
                                configuredUrl.hostname === '127.0.0.1';
      if (!isLocalhostOrZero) {
        callbackUrl = `${process.env.NEXTAUTH_URL.replace(/\/$/, '')}/api/flickr/callback`;
      }
    } catch (e) {
      console.warn('Invalid NEXTAUTH_URL configured:', process.env.NEXTAUTH_URL);
    }
  }

  const request_data = {
    url: 'https://www.flickr.com/services/oauth/request_token',
    method: 'GET',
    data: {
      oauth_callback: callbackUrl,
    },
  };

  const oauth = await getFlickrOAuth();
  const url = new URL(request_data.url);
  const authorized = oauth.authorize(request_data) as unknown as Record<string, string>;
  Object.keys(authorized).forEach((key) => url.searchParams.append(key, authorized[key]));

  try {
    const response = await fetch(url.toString());
    let data;
    try {
      data = await response.text();
    } catch (e) {
      if (response.body) {
        try {
          await response.body.cancel();
        } catch {}
      }
      throw e;
    }
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
      secure: isSecure,
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
