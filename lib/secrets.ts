import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

// Singleton pattern to prevent multiple clients in HMR
const globalForSecrets = global as unknown as { 
  secretManagerClient: SecretManagerServiceClient | undefined 
};

const client = globalForSecrets.secretManagerClient ?? new SecretManagerServiceClient();

if (process.env.NODE_ENV !== 'production') {
  globalForSecrets.secretManagerClient = client;
}

const PROJECT_ID = 'photos-to-flickr-exporter';

const secretCache: Record<string, string> = {};

/**
 * Fetches a secret from Google Secret Manager.
 * Falls back to process.env for local development.
 */
export async function getSecret(name: string): Promise<string> {
  if (secretCache[name]) {
    return secretCache[name];
  }

  console.log(`[Secrets] Fetching secret: ${name}`);

  // If we're in development and the secret is in process.env, use it.
  if (process.env.NODE_ENV === 'development' && process.env[name]) {
    console.log(`[Secrets] Found ${name} in process.env`);
    return process.env[name] as string;
  }

  try {
    const [version] = await client.accessSecretVersion({
      name: `projects/${PROJECT_ID}/secrets/${name}/versions/latest`,
    });

    const payload = version.payload?.data?.toString();
    if (!payload) {
      throw new Error(`Secret ${name} has no payload`);
    }

    secretCache[name] = payload;
    return payload;
  } catch (error) {
    console.error(`Error fetching secret ${name} from GSM:`, error);
    
    // Final fallback to process.env if GSM fails
    if (process.env[name]) {
      return process.env[name] as string;
    }
    
    return '';
  }
}
