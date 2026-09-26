import NextAuth, { type NextAuthConfig } from "next-auth";
import Apple from "next-auth/providers/apple";
import Credentials from "next-auth/providers/credentials";
import Facebook from "next-auth/providers/facebook";
import Google from "next-auth/providers/google";
import { encode as defaultEncode } from "@auth/core/jwt";
import { socialConfig } from "@/lib/providers";
import { isOAuthProvider } from "@/lib/social";
import { authenticate, findUserByEmail, findUserByProvider, upsertOAuthUser } from "@/lib/users";

function resolveSecret(): string | undefined {
  if (process.env.AUTH_SECRET?.trim()) return process.env.AUTH_SECRET.trim();
  if (process.env.NODE_ENV !== "production") return "dev-only-dramame-secret-not-for-production";
  if (process.env.NEXT_PHASE === "phase-production-build") return "build-time-placeholder-not-a-runtime-secret";
  return undefined;
}

const flags = socialConfig();
const providers: NextAuthConfig["providers"] = [
  Credentials({
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
      remember: { label: "Remember", type: "text" },
    },
    authorize: async (credentials) => {
      const email = String(credentials?.email ?? "");
      const password = String(credentials?.password ?? "");
      const remember = String(credentials?.remember ?? "") === "yes";
      const result = authenticate(email, password);
      if (result.status !== "ok") return null;
      return {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
        remember,
      };
    },
  }),
];

if (flags.google) providers.push(Google({ allowDangerousEmailAccountLinking: true }));
if (flags.facebook) providers.push(Facebook({ allowDangerousEmailAccountLinking: true }));
if (flags.apple) providers.push(Apple({ allowDangerousEmailAccountLinking: true }));

const sessionMaxAge = 30 * 24 * 60 * 60;
const shortSession = 12 * 60 * 60;

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  secret: resolveSecret(),
  providers,
  session: { strategy: "jwt", maxAge: sessionMaxAge },
  pages: { signIn: "/login", error: "/login" },
  callbacks: {
    authorized({ auth: session, request }) {
      if (request.nextUrl.pathname.startsWith("/account")) return Boolean(session?.user);
      return true;
    },
    async signIn({ user, account }) {
      if (!account || account.provider === "credentials") return true;
      if (!isOAuthProvider(account.provider) || !user.email) return false;
      upsertOAuthUser({
        email: user.email,
        name: user.name ?? "Viewer",
        provider: account.provider,
        providerAccountId: account.providerAccountId,
      });
      return true;
    },
    async jwt({ token, user, account }) {
      if (account && account.provider !== "credentials" && isOAuthProvider(account.provider)) {
        const local =
          findUserByProvider(account.provider, account.providerAccountId) ??
          (user?.email ? findUserByEmail(user.email) : null);
        if (local) {
          token.sub = local.id;
          token.email = local.email;
          token.name = local.name;
        }
      } else if (user) {
        token.sub = user.id;
        token.email = user.email;
        token.name = user.name;
        token.remember = Boolean(user.remember);
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";
        if (token.email) session.user.email = token.email;
        if (typeof token.name === "string") session.user.name = token.name;
      }
      return session;
    },
  },
  jwt: {
    async encode(params) {
      const maxAge = params.token?.remember === false ? shortSession : (params.maxAge ?? sessionMaxAge);
      return defaultEncode({ ...params, maxAge });
    },
  },
});
