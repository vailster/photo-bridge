import { NextRequest, NextResponse } from 'next/server';
import { getFlickrOAuth } from '@/lib/flickr-oauth';
import { cookies } from 'next/headers';

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const oauth_token = searchParams.get('oauth_token');
  const oauth_verifier = searchParams.get('oauth_verifier');

  if (!oauth_token || !oauth_verifier) {
    return NextResponse.json({ error: 'Missing oauth parameters' }, { status: 400 });
  }

  const cookieStore = await cookies();
  const request_token_secret = cookieStore.get('flickr_request_token_secret')?.value;

  if (!request_token_secret) {
    return NextResponse.json({ error: 'Session expired or invalid' }, { status: 400 });
  }

  const request_data = {
    url: 'https://www.flickr.com/services/oauth/access_token',
    method: 'GET',
    data: {
      oauth_verifier,
    },
  };

  const oauth = await getFlickrOAuth();
  const url = new URL(request_data.url);
  const authorized = oauth.authorize(request_data, {
    key: oauth_token,
    secret: request_token_secret,
  }) as unknown as Record<string, string>;
  
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
    
    const access_token = params.get('oauth_token');
    const access_token_secret = params.get('oauth_token_secret');
    const username = params.get('username') || '';

    if (!access_token || !access_token_secret) {
      return NextResponse.json({ error: 'Failed to get access token' }, { status: 500 });
    }

    const isSecure = req.nextUrl.protocol === 'https:' || req.headers.get('x-forwarded-proto') === 'https';

    // Store the access token securely in HTTP-only cookies
    cookieStore.set('flickr_access_token', access_token, {
      httpOnly: true,
      secure: isSecure,
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: '/',
    });
    cookieStore.set('flickr_access_token_secret', access_token_secret, {
      httpOnly: true,
      secure: isSecure,
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: '/',
    });
    
    if (username) {
      cookieStore.set('flickr_username', decodeURIComponent(username), {
        httpOnly: true,
        secure: isSecure,
        maxAge: 60 * 60 * 24 * 30, // 30 days
        path: '/',
      });
    }
    
    // Clear the temporary request token secret
    cookieStore.delete('flickr_request_token_secret');

    return NextResponse.redirect(new URL('/', req.url));

  } catch (error) {
    console.error('Error getting access token', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
