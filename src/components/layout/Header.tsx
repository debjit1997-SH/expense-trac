"use client";

import React, { useState, useEffect } from "react";
import { Role } from "@prisma/client";
import { signOut } from "next-auth/react";
import { formatInTimeZone } from "date-fns-tz";
import { TIMEZONE_KOLKATA } from "@/lib/formatters";
import { Clock, Shield, ShieldCheck, User, LogOut } from "lucide-react";
import { Badge } from "@/components/ui/Badge";

interface HeaderProps {
  userName: string;
  userEmail: string;
  userRole: Role;
}

export function Header({ userName, userEmail, userRole }: HeaderProps) {
  const [istTime, setIstTime] = useState<string>("");

  useEffect(() => {
    const updateTime = () => {
      const formatted = formatInTimeZone(
        new Date(),
        TIMEZONE_KOLKATA,
        "dd MMM yyyy, hh:mm:ss a"
      );
      setIstTime(`${formatted} IST`);
    };

    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  const getRoleBadge = () => {
    switch (userRole) {
      case Role.SUPERADMIN:
        return (
          <Badge variant="warning" className="gap-1 bg-amber-100 text-amber-900 border-amber-300">
            <ShieldCheck className="w-3 h-3" /> SUPERADMIN
          </Badge>
        );
      case Role.ADMIN:
        return (
          <Badge variant="info" className="gap-1 bg-blue-100 text-blue-900 border-blue-300">
            <Shield className="w-3 h-3" /> ADMIN
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="gap-1 bg-slate-100 text-slate-700">
            <User className="w-3 h-3" /> USER
          </Badge>
        );
    }
  };

  return (
    <header className="h-16 border-b border-slate-200 bg-white px-6 flex items-center justify-between sticky top-0 z-30 shadow-sm">
      <div className="flex items-center space-x-3">
        <div className="flex items-center gap-2 text-xs font-medium text-slate-600 bg-slate-50 px-3 py-1.5 rounded-md border border-slate-200">
          <Clock className="w-3.5 h-3.5 text-blue-600" />
          <span>{istTime || "Loading time..."}</span>
        </div>
      </div>

      <div className="flex items-center space-x-4">
        {getRoleBadge()}

        <div className="hidden sm:flex flex-col text-right">
          <span className="text-xs font-bold text-slate-800">{userName}</span>
          <span className="text-[11px] text-slate-500">{userEmail}</span>
        </div>

        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-red-600 hover:bg-red-50 px-2.5 py-1.5 rounded-md border border-slate-200 transition-colors"
          title="Sign Out"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Logout</span>
        </button>
      </div>
    </header>
  );
}
