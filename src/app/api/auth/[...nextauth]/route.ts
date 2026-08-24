import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

// Dynamically populate NEXTAUTH_URL and NEXTAUTH_SECRET on Vercel if not manually set
if (!process.env.NEXTAUTH_URL && process.env.VERCEL_URL) {
  process.env.NEXTAUTH_URL = `https://${process.env.VERCEL_URL}`;
}
if (!process.env.NEXTAUTH_SECRET) {
  process.env.NEXTAUTH_SECRET = "skim-production-secret-fallback-key-998877665544332211";
}

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
