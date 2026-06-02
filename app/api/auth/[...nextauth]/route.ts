import NextAuth, { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { getSecret } from "@/lib/secrets";

async function getAuthOptions(): Promise<NextAuthOptions> {
  const nextauthUrl = process.env.NEXTAUTH_URL;
  const useSecureCookies = nextauthUrl ? nextauthUrl.startsWith("https://") : false;

  return {
    useSecureCookies,
    providers: [
      GoogleProvider({
        clientId: await getSecret("GOOGLE_CLIENT_ID"),
        clientSecret: await getSecret("GOOGLE_CLIENT_SECRET"),
        authorization: {
          params: {
            scope: "openid email profile https://www.googleapis.com/auth/photospicker.mediaitems.readonly",
            prompt: "consent",
            access_type: "offline",
            response_type: "code"
          }
        }
      }),
    ],
    secret: (await getSecret("NEXTAUTH_SECRET")) || "some-fallback-secret-for-dev",
    debug: process.env.NODE_ENV === 'development',
    callbacks: {
      async jwt({ token, account }) {
        // Persist the OAuth access_token to the token right after signin
        if (account) {
          console.log("OAUTH ACCOUNT SCOPES:", account.scope);
          token.accessToken = account.access_token;
        }
        return token;
      },
      async session({ session, token }) {
        // Send properties to the client, like an access_token from a provider.
        session.accessToken = token.accessToken as string;
        return session;
      }
    }
  };
}

export async function GET(req: any, res: any) {
  const options = await getAuthOptions();
  return await NextAuth(req, res, options);
}

export async function POST(req: any, res: any) {
  const options = await getAuthOptions();
  return await NextAuth(req, res, options);
}

