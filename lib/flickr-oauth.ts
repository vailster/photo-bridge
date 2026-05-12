import OAuth from 'oauth-1.0a';
import crypto from 'crypto-js';
import { getSecret } from './secrets';

export async function getFlickrOAuth() {
  const key = await getSecret('FLICKR_API_KEY');
  const secret = await getSecret('FLICKR_API_SECRET');

  return new OAuth({
    consumer: {
      key: key,
      secret: secret,
    },
    signature_method: 'HMAC-SHA1',
    hash_function(base_string, key) {
      return crypto.HmacSHA1(base_string, key).toString(crypto.enc.Base64);
    },
  });
}
