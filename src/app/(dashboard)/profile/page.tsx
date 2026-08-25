import React from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-utils";
import prisma from "@/lib/db";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { DateDisplay } from "@/components/common/DateDisplay";
import { User, Mail, Phone, ShieldCheck, Shield, Calendar, Layers } from "lucide-react";

export default async function ProfilePage() {
  const sessionUser = await getCurrentUser();
  if (!sessionUser) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    include: {
      _count: {
        select: {
          expenseReports: true,
          approvedReports: true,
          reimbursedReports: true,
        },
      },
    },
  });

  if (!user) redirect("/login");

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase">
          User Profile
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Your personal account information and activity summary
        </p>
      </div>

      <Card className="shadow-sm border-slate-200">
        <CardHeader className="py-4 bg-slate-50/70 border-b border-slate-100 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <User className="w-5 h-5 text-blue-600" />
            <CardTitle className="text-base font-bold text-slate-900">
              Account Credentials
            </CardTitle>
          </div>
          <Badge variant="success">{user.status}</Badge>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-xs font-semibold text-slate-400 block uppercase">
                Full Name
              </span>
              <p className="font-bold text-slate-900 mt-0.5">{user.name}</p>
            </div>

            <div>
              <span className="text-xs font-semibold text-slate-400 block uppercase">
                Assigned Role
              </span>
              <div className="mt-1">
                <Badge variant={user.role === "SUPERADMIN" ? "warning" : user.role === "ADMIN" ? "info" : "secondary"}>
                  {user.role}
                </Badge>
              </div>
            </div>

            <div>
              <span className="text-xs font-semibold text-slate-400 block uppercase flex items-center gap-1">
                <Mail className="w-3.5 h-3.5" /> Email Address
              </span>
              <p className="font-mono text-slate-800 mt-0.5">{user.email}</p>
            </div>

            <div>
              <span className="text-xs font-semibold text-slate-400 block uppercase flex items-center gap-1">
                <Phone className="w-3.5 h-3.5" /> Phone Number
              </span>
              <p className="font-mono text-slate-800 mt-0.5">{user.phone}</p>
            </div>

            <div>
              <span className="text-xs font-semibold text-slate-400 block uppercase flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" /> Account Created
              </span>
              <p className="text-slate-700 mt-0.5">
                <DateDisplay date={user.createdAt} />
              </p>
            </div>

            <div>
              <span className="text-xs font-semibold text-slate-400 block uppercase flex items-center gap-1">
                <Layers className="w-3.5 h-3.5" /> Total Expense Reports Created
              </span>
              <p className="font-bold text-blue-700 mt-0.5">
                {user._count.expenseReports} Reports
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
