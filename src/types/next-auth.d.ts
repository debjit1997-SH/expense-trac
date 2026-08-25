import { Role, AccountStatus } from "@prisma/client";
import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    id: string;
    role: Role;
    status: AccountStatus;
    phone: string;
  }

  interface Session {
    user: {
      id: string;
      role: Role;
      status: AccountStatus;
      phone: string;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: Role;
    status: AccountStatus;
    phone: string;
  }
}
