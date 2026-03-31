import NextAuth from "next-auth";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import pool from "./db";

export type UserRole =
  | "Business Requester"
  | "IS Reviewer"
  | "IS Engineer"
  | "Admin";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      entraId: string;
      name: string;
      email: string;
      roles: UserRole[];
    };
  }

  interface JWT {
    userId: string;
    entraId: string;
    roles: UserRole[];
  }
}

/**
 * Upsert a user from Entra ID sign-in into the local users table.
 * Returns the local user id.
 */
async function upsertUser(entraId: string, name: string, email: string): Promise<string> {
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO users (entra_id, name, email)
     VALUES ($1, $2, $3)
     ON CONFLICT (entra_id) DO UPDATE SET name = $2, email = $3
     RETURNING id`,
    [entraId, name, email]
  );
  return rows[0].id;
}

async function getUserRoles(userId: string): Promise<UserRole[]> {
  const { rows } = await pool.query<{ role: UserRole }>(
    "SELECT role FROM user_roles WHERE user_id = $1",
    [userId]
  );
  return rows.map((r) => r.role);
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    MicrosoftEntraID({
      clientId: process.env.AZURE_AD_CLIENT_ID!,
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET!,
      issuer: `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID}/v2.0`,
    }),
  ],
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, account, profile }) {
      // On initial sign-in, persist user and fetch roles
      if (account && profile) {
        const entraId = profile.sub ?? account.providerAccountId;
        const name = (profile.name as string) ?? "";
        const email = (profile.email as string) ?? "";

        const userId = await upsertUser(entraId, name, email);
        const roles = await getUserRoles(userId);

        token.userId = userId;
        token.entraId = entraId;
        token.roles = roles;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.userId as string;
      session.user.entraId = token.entraId as string;
      session.user.roles = (token.roles as UserRole[]) ?? [];
      return session;
    },
  },
});
