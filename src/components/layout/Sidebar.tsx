"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Role } from "@prisma/client";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard,
  Receipt,
  PlusCircle,
  ListFilter,
  Undo2,
  Users,
  UserCheck,
  FolderTree,
  Percent,
  User,
  LogOut,
  ShieldCheck,
  Shield,
  CreditCard,
  Inbox,
  Banknote,
  BarChart3,
  FileSpreadsheet,
  PieChart,
} from "lucide-react";

interface SidebarProps {
  userRole: Role;
  userName: string;
  userEmail: string;
}

export function Sidebar({ userRole, userName, userEmail }: SidebarProps) {
  const pathname = usePathname();

  const isUser = userRole === Role.USER;
  const isAdmin = userRole === Role.ADMIN;
  const isSuperAdmin = userRole === Role.SUPERADMIN;
  const hasAdminPrivileges = isAdmin || isSuperAdmin;

  const isActive = (path: string) => {
    if (path === "/dashboard") {
      return pathname === "/dashboard";
    }
    if (path === "/expenses/create") {
      return pathname === "/expenses/create";
    }
    if (path === "/expenses/rollback") {
      return pathname === "/expenses/rollback" || pathname === "/rollback";
    }
    if (path === "/approval-inbox") {
      return pathname === "/approval-inbox" || pathname.startsWith("/approval-inbox");
    }
    if (path === "/reimbursement-inbox") {
      return pathname === "/reimbursement-inbox" || pathname.startsWith("/reimbursement-inbox");
    }
    if (path === "/expenses") {
      return (
        pathname === "/expenses" ||
        (pathname.startsWith("/expenses/") &&
          !pathname.startsWith("/expenses/create") &&
          !pathname.startsWith("/expenses/rollback"))
      );
    }
    if (path.startsWith("/user-management")) {
      return pathname === "/user-management" || pathname.startsWith("/user-management");
    }
    if (path.startsWith("/master-management/categories")) {
      return pathname.startsWith("/master-management/categories");
    }
    if (path.startsWith("/master-management/gst")) {
      return pathname.startsWith("/master-management/gst");
    }
    if (path === "/profile") {
      return pathname === "/profile";
    }
    return pathname === path;
  };

  const navItemClass = (path: string) =>
    `flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
      isActive(path)
        ? "bg-blue-700 text-white shadow-sm"
        : "text-slate-300 hover:bg-slate-800 hover:text-white"
    }`;

  const subNavItemClass = (path: string) =>
    `flex items-center gap-2.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors pl-8 ${
      isActive(path)
        ? "bg-blue-600/80 text-white font-semibold"
        : "text-slate-400 hover:bg-slate-800/80 hover:text-slate-200"
    }`;

  return (
    <aside className="w-64 bg-slate-900 text-slate-100 flex flex-col shrink-0 border-r border-slate-800 min-h-screen">
      {/* Brand Header */}
      <div className="p-5 border-b border-slate-800 flex items-center gap-3">
        <div className="p-2 rounded-lg bg-blue-600 text-white">
          <CreditCard className="w-5 h-5" />
        </div>
        <div>
          <h1 className="font-bold text-xs text-white tracking-wider">RADICAL HEALTH TECH</h1>
          <p className="text-[10px] text-slate-400 font-medium">Expense Portal</p>
        </div>
      </div>

      {/* Navigation Menus */}
      <div className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
        {/* DASHBOARD */}
        <div>
          <Link href="/dashboard" className={navItemClass("/dashboard")}>
            <LayoutDashboard className="w-4 h-4" />
            <span>DASHBOARD</span>
          </Link>
        </div>

        {/* EXPENSE MANAGEMENT */}
        <div className="space-y-1">
          <div className="px-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
            <Receipt className="w-3.5 h-3.5 text-blue-400" />
            EXPENSE MANAGEMENT
          </div>
          <div className="pt-1 space-y-0.5">
            <Link key="nav-exp-create" href="/expenses/create" className={subNavItemClass("/expenses/create")}>
              <PlusCircle className="w-3.5 h-3.5" />
              CREATE EXPENSE
            </Link>
            <Link key="nav-exp-view" href="/expenses" className={subNavItemClass("/expenses")}>
              <ListFilter className="w-3.5 h-3.5" />
              VIEW EXPENSES
            </Link>
            <Link key="nav-exp-rollback" href="/expenses/rollback" className={subNavItemClass("/expenses/rollback")}>
              <Undo2 className="w-3.5 h-3.5" />
              ROLLBACK SUBMITTED
            </Link>

            {/* Approval Inbox for Admin and Superadmin */}
            {hasAdminPrivileges && (
              <Link key="nav-approval-inbox" href="/approval-inbox" className={subNavItemClass("/approval-inbox")}>
                <Inbox className="w-3.5 h-3.5 text-blue-300" />
                APPROVAL INBOX
              </Link>
            )}

            {/* Reimbursement Inbox for Superadmin */}
            {isSuperAdmin && (
              <Link key="nav-reimbursement-inbox" href="/reimbursement-inbox" className={subNavItemClass("/reimbursement-inbox")}>
                <Banknote className="w-3.5 h-3.5 text-purple-300" />
                REIMBURSEMENT INBOX
              </Link>
            )}
          </div>
        </div>

        {/* USER MANAGEMENT (ADMIN & SUPERADMIN ONLY) */}
        {hasAdminPrivileges && (
          <div className="space-y-1">
            <div className="px-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <Users className="w-3.5 h-3.5 text-emerald-400" />
              USER MANAGEMENT
            </div>
            <div className="pt-1 space-y-0.5">
              <Link
                href="/user-management?tab=requests"
                className={subNavItemClass("/user-management?tab=requests")}
              >
                <UserCheck className="w-3.5 h-3.5" />
                ACCESS REQUESTS
              </Link>
              <Link
                href="/user-management?tab=active"
                className={subNavItemClass("/user-management?tab=active")}
              >
                <Users className="w-3.5 h-3.5" />
                USERS
              </Link>
            </div>
          </div>
        )}

        {/* MASTER MANAGEMENT (ADMIN & SUPERADMIN ONLY) */}
        {hasAdminPrivileges && (
          <div className="space-y-1">
            <div className="px-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <FolderTree className="w-3.5 h-3.5 text-amber-400" />
              MASTER MANAGEMENT
            </div>
            <div className="pt-1 space-y-0.5">
              <Link
                href="/master-management/categories"
                className={subNavItemClass("/master-management/categories")}
              >
                <FolderTree className="w-3.5 h-3.5" />
                EXPENSE CATEGORIES
              </Link>
              <Link
                href="/master-management/gst"
                className={subNavItemClass("/master-management/gst")}
              >
                <Percent className="w-3.5 h-3.5" />
                GST SETTINGS
              </Link>
            </div>
          </div>
        )}

        {/* REPORTS (ADMIN & SUPERADMIN ONLY) */}
        {hasAdminPrivileges && (
          <div className="space-y-1">
            <div className="px-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <BarChart3 className="w-3.5 h-3.5 text-cyan-400" />
              REPORTS
            </div>
            <div className="pt-1 space-y-0.5">
              <Link
                href="/reports/expenses"
                className={subNavItemClass("/reports/expenses")}
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                DETAILED EXPENSE REPORT
              </Link>
              <Link
                href="/reports/category-analytics"
                className={subNavItemClass("/reports/category-analytics")}
              >
                <PieChart className="w-3.5 h-3.5" />
                CATEGORY ANALYTICS
              </Link>
              <Link
                href="/reports/gst"
                className={subNavItemClass("/reports/gst")}
              >
                <Percent className="w-3.5 h-3.5" />
                GST EXPENSE REGISTER
              </Link>
            </div>
          </div>
        )}

        {/* PROFILE */}
        <div>
          <Link href="/profile" className={navItemClass("/profile")}>
            <User className="w-4 h-4" />
            <span>PROFILE</span>
          </Link>
        </div>
      </div>

      {/* Footer / User Profile & Logout */}
      <div className="p-3 border-t border-slate-800 bg-slate-950/50">
        <div className="flex items-center justify-between px-2 py-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              {isSuperAdmin ? (
                <ShieldCheck className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              ) : isAdmin ? (
                <Shield className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              ) : (
                <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              )}
              <p className="text-xs font-semibold text-white truncate">{userName}</p>
            </div>
            <p className="text-[11px] text-slate-400 truncate">{userRole}</p>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-md transition-colors"
            title="Sign Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
