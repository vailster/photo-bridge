import OAuth from 'oauth-1.0a';
import crypto from 'crypto-js';

const oauth = new OAuth({
  consumer: {
    key: process.env.FLICKR_API_KEY || '',
    secret: process.env.FLICKR_API_SECRET || '',
  },
  signature_method: 'HMAC-SHA1',
  hash_function(base_string, key) {
    return crypto.HmacSHA1(base_string, key).toString(crypto.enc.Base64);
  },
});

export default oauth;
