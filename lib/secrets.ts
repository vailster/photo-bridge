import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

// Singleton pattern to prevent multiple clients in HMR
const globalForSecrets = global as unknown as { 
  secretManagerClient: SecretManagerServiceClient | undefined 
};

function getClient(): SecretManagerServiceClient {
  if (!globalForSecrets.secretManagerClient) {
    globalForSecrets.secretManagerClient = new SecretManagerServiceClient();
  }
  return globalForSecrets.secretManagerClient;
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

  // Check process.env first (for local development/testing)
  if (process.env[name]) {
    console.log(`[Secrets] Found ${name} in process.env`);
    secretCache[name] = process.env[name] as string;
    return secretCache[name];
  }

  console.log(`[Secrets] Fetching secret ${name} from Google Secret Manager`);

  try {
    const client = getClient();
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
    return '';
  }
}
