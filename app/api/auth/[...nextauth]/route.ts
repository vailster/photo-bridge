import NextAuth, { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { getSecret } from "@/lib/secrets";

const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: await getSecret("GOOGLE_CLIENT_ID"),
      clientSecret: await getSecret("GOOGLE_CLIENT_SECRET"),
      authorization: "https://accounts.google.com/o/oauth2/v2/auth?prompt=consent&access_type=offline&response_type=code&scope=openid%20email%20profile%20https://www.googleapis.com/auth/photospicker.mediaitems.readonly"
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

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
