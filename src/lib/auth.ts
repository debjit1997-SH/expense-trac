import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import prisma from "./db";
import { LoginSchema } from "./validations/auth.schema";
import { Role, AccountStatus } from "@prisma/client";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const validated = LoginSchema.safeParse(credentials);
        if (!validated.success) {
          throw new Error("Invalid email or password");
        }

        const { email, password } = validated.data;

        const user = await prisma.user.findUnique({
          where: { email },
        });

        // Constant time check simulation or standard generic error to prevent email enumeration
        if (!user) {
          throw new Error("Invalid email or password");
        }

        const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
        if (!isPasswordValid) {
          throw new Error("Invalid email or password");
        }

        // Enforce account status check
        if (user.status === AccountStatus.PENDING) {
          throw new Error("Your access request is awaiting approval.");
        }

        if (user.status === AccountStatus.REJECTED) {
          throw new Error(
            "Your access request was rejected. Please contact the administrator."
          );
        }

        if (user.status === AccountStatus.DISABLED) {
          throw new Error("Your account has been disabled.");
        }

        if (user.status !== AccountStatus.ACTIVE) {
          throw new Error("Account is not active.");
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          status: user.status,
        };
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.role = user.role as Role;
        token.status = user.status as AccountStatus;
        token.phone = user.phone;
      }

      // Allow session updates if triggered
      if (trigger === "update" && session?.user) {
        token.role = session.user.role;
        token.status = session.user.status;
      }

      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as Role;
        session.user.status = token.status as AccountStatus;
        session.user.phone = token.phone as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  secret: process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET,
  trustHost: true,
});
