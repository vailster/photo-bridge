const PROJECT_ID = 'photos-to-flickr-exporter';
const secretCache: Record<string, string> = {};

async function getMetadataToken(): Promise<string> {
  const res = await fetch(
    'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token',
    {
      headers: {
        'Metadata-Flavor': 'Google',
      },
    }
  );
  if (!res.ok) {
    throw new Error(`Metadata server returned status ${res.status}`);
  }
  const data = await res.json();
  return data.access_token;
}

/**
 * Fetches a secret from Google Secret Manager using REST API.
 * Falls back to process.env for local development.
 */
export async function getSecret(name: string): Promise<string> {
  if (secretCache[name]) {
    return secretCache[name];
  }

  // Check process.env first (for local development/testing)
  if (process.env[name]) {
    console.log(`[Secrets] Found ${name} in process.env`);
    secretCache[name] = process.env[name] as string;
    return secretCache[name];
  }

  console.log(`[Secrets] Fetching secret ${name} from Google Secret Manager (REST)...`);

  try {
    const token = await getMetadataToken();
    const url = `https://secretmanager.googleapis.com/v1/projects/${PROJECT_ID}/secrets/${name}/versions/latest:access`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      throw new Error(`Secret Manager API returned status ${res.status}`);
    }

    const data = await res.json();
    const base64Payload = data.payload?.data;
    if (!base64Payload) {
      throw new Error('No payload data found in secret');
    }

    const payload = Buffer.from(base64Payload, 'base64').toString('utf8');
    secretCache[name] = payload;
    return payload;
  } catch (error: any) {
    console.error(`Error fetching secret ${name} from GSM:`, error?.message || error);
    return '';
  }
}
