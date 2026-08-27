"use client";

import React, { useState, useEffect } from "react";
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
  ChevronLeft,
  ChevronRight,
  Wallet,
  HandCoins,
  FileCheck,
  Coins,
} from "lucide-react";

interface SidebarProps {
  userRole: Role;
  userName: string;
  userEmail: string;
}

export function Sidebar({ userRole, userName, userEmail }: SidebarProps) {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const [mounted, setMounted] = useState<boolean>(false);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem("expense_app_sidebar_collapsed");
    if (saved === "true") {
      setIsCollapsed(true);
    }
  }, []);

  const toggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("expense_app_sidebar_collapsed", String(next));
      return next;
    });
  };

  const isUser = userRole === Role.USER;
  const isAdmin = userRole === Role.ADMIN;
  const isSuperAdmin = userRole === Role.SUPERADMIN;
  const hasAdminPrivileges = isAdmin || isSuperAdmin;

  const isActive = (path: string) => {
    if (path === "/dashboard") return pathname === "/dashboard";
    if (path === "/expenses/create") return pathname === "/expenses/create";
    if (path === "/expenses/rollback") return pathname === "/expenses/rollback" || pathname === "/rollback";
    if (path === "/approval-inbox") return pathname === "/approval-inbox" || pathname.startsWith("/approval-inbox");
    if (path === "/reimbursement-inbox") return pathname === "/reimbursement-inbox" || pathname.startsWith("/reimbursement-inbox");
    if (path === "/expenses") {
      return (
        pathname === "/expenses" ||
        (pathname.startsWith("/expenses/") &&
          !pathname.startsWith("/expenses/create") &&
          !pathname.startsWith("/expenses/rollback"))
      );
    }
    if (path === "/advances/create") return pathname === "/advances/create";
    if (path === "/advances/approvals") return pathname.startsWith("/advances/approvals");
    if (path === "/advances/disbursements") return pathname.startsWith("/advances/disbursements");
    if (path === "/advances") {
      return (
        pathname === "/advances" ||
        (pathname.startsWith("/advances/") &&
          !pathname.startsWith("/advances/create") &&
          !pathname.startsWith("/advances/approvals") &&
          !pathname.startsWith("/advances/disbursements"))
      );
    }
    if (path === "/reports/advances") return pathname.startsWith("/reports/advances");
    if (path.startsWith("/user-management")) return pathname.startsWith("/user-management");
    if (path.startsWith("/master-management/categories")) return pathname.startsWith("/master-management/categories");
    if (path.startsWith("/master-management/gst")) return pathname.startsWith("/master-management/gst");
    if (path === "/profile") return pathname === "/profile";
    return pathname === path;
  };

  const navItemClass = (path: string) =>
    `flex items-center ${isCollapsed ? "justify-center px-2" : "gap-3 px-3"} py-2 text-sm font-medium rounded-md transition-all ${
      isActive(path)
        ? "bg-blue-700 text-white shadow-sm"
        : "text-slate-300 hover:bg-slate-800 hover:text-white"
    }`;

  const subNavItemClass = (path: string) =>
    `flex items-center ${isCollapsed ? "justify-center px-2" : "gap-2.5 px-3 pl-8"} py-1.5 text-xs font-medium rounded-md transition-all ${
      isActive(path)
        ? "bg-blue-600/80 text-white font-semibold"
        : "text-slate-400 hover:bg-slate-800/80 hover:text-slate-200"
    }`;

  return (
    <aside
      className={`${
        isCollapsed ? "w-20" : "w-64"
      } bg-slate-900 text-slate-100 flex flex-col shrink-0 border-r border-slate-800 min-h-screen transition-all duration-200 ease-in-out`}
    >
      {/* Brand Header */}
      <div className={`p-4 border-b border-slate-800 flex items-center ${isCollapsed ? "justify-center" : "justify-between"}`}>
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 rounded-lg bg-blue-600 text-white shrink-0">
            <CreditCard className="w-5 h-5" />
          </div>
          {!isCollapsed && (
            <div className="min-w-0">
              <h1 className="font-bold text-xs text-white tracking-wider truncate">RADICAL HEALTH TECH</h1>
              <p className="text-[10px] text-slate-400 font-medium truncate">Expense & Advance Portal</p>
            </div>
          )}
        </div>
        <button
          onClick={toggleCollapse}
          className={`p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-md transition-colors ${
            isCollapsed ? "hidden" : "block"
          }`}
          title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          aria-label={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>

      {isCollapsed && (
        <div className="p-2 border-b border-slate-800 flex justify-center">
          <button
            onClick={toggleCollapse}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-md transition-colors"
            title="Expand Sidebar"
            aria-label="Expand Sidebar"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Navigation Menus */}
      <div className="flex-1 overflow-y-auto py-4 px-2 space-y-5">
        {/* DASHBOARD */}
        <div>
          <Link href="/dashboard" className={navItemClass("/dashboard")} title="Dashboard">
            <LayoutDashboard className="w-4 h-4 shrink-0" />
            {!isCollapsed && <span>DASHBOARD</span>}
          </Link>
        </div>

        {/* EMPLOYEE ADVANCES */}
        <div className="space-y-1">
          {!isCollapsed && (
            <div className="px-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <Wallet className="w-3.5 h-3.5 text-emerald-400" />
              EMPLOYEE ADVANCES
            </div>
          )}
          <div className="pt-1 space-y-0.5">
            <Link href="/advances/create" className={subNavItemClass("/advances/create")} title="Request Advance">
              <HandCoins className="w-3.5 h-3.5 shrink-0 text-emerald-300" />
              {!isCollapsed && <span>REQUEST ADVANCE</span>}
            </Link>
            <Link href="/advances" className={subNavItemClass("/advances")} title="My Advances">
              <Coins className="w-3.5 h-3.5 shrink-0" />
              {!isCollapsed && <span>MY ADVANCES</span>}
            </Link>

            {/* Advance Approvals for Admin & Superadmin */}
            {hasAdminPrivileges && (
              <Link href="/advances/approvals" className={subNavItemClass("/advances/approvals")} title="Advance Approvals">
                <FileCheck className="w-3.5 h-3.5 shrink-0 text-amber-300" />
                {!isCollapsed && <span>ADVANCE APPROVALS</span>}
              </Link>
            )}

            {/* Advance Disbursement & Settlement for Superadmin */}
            {isSuperAdmin && (
              <Link
                href="/advances/disbursements"
                className={subNavItemClass("/advances/disbursements")}
                title="Disburse & Settle"
              >
                <Banknote className="w-3.5 h-3.5 shrink-0 text-purple-300" />
                {!isCollapsed && <span>DISBURSE & SETTLE</span>}
              </Link>
            )}
          </div>
        </div>

        {/* EXPENSE MANAGEMENT */}
        <div className="space-y-1">
          {!isCollapsed && (
            <div className="px-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <Receipt className="w-3.5 h-3.5 text-blue-400" />
              EXPENSE MANAGEMENT
            </div>
          )}
          <div className="pt-1 space-y-0.5">
            <Link href="/expenses/create" className={subNavItemClass("/expenses/create")} title="Create Expense">
              <PlusCircle className="w-3.5 h-3.5 shrink-0" />
              {!isCollapsed && <span>CREATE EXPENSE</span>}
            </Link>
            <Link href="/expenses" className={subNavItemClass("/expenses")} title="View Expenses">
              <ListFilter className="w-3.5 h-3.5 shrink-0" />
              {!isCollapsed && <span>VIEW EXPENSES</span>}
            </Link>
            <Link href="/expenses/rollback" className={subNavItemClass("/expenses/rollback")} title="Rollback Submitted">
              <Undo2 className="w-3.5 h-3.5 shrink-0" />
              {!isCollapsed && <span>ROLLBACK SUBMITTED</span>}
            </Link>

            {/* Approval Inbox for Admin and Superadmin */}
            {hasAdminPrivileges && (
              <Link href="/approval-inbox" className={subNavItemClass("/approval-inbox")} title="Approval Inbox">
                <Inbox className="w-3.5 h-3.5 shrink-0 text-blue-300" />
                {!isCollapsed && <span>APPROVAL INBOX</span>}
              </Link>
            )}

            {/* Reimbursement Inbox for Superadmin */}
            {isSuperAdmin && (
              <Link
                href="/reimbursement-inbox"
                className={subNavItemClass("/reimbursement-inbox")}
                title="Reimbursement Inbox"
              >
                <Banknote className="w-3.5 h-3.5 shrink-0 text-purple-300" />
                {!isCollapsed && <span>REIMBURSEMENT INBOX</span>}
              </Link>
            )}
          </div>
        </div>

        {/* REPORTS (ADMIN & SUPERADMIN ONLY) */}
        {hasAdminPrivileges && (
          <div className="space-y-1">
            {!isCollapsed && (
              <div className="px-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <BarChart3 className="w-3.5 h-3.5 text-cyan-400" />
                REPORTS
              </div>
            )}
            <div className="pt-1 space-y-0.5">
              <Link href="/reports/advances" className={subNavItemClass("/reports/advances")} title="Advance Register">
                <Wallet className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
                {!isCollapsed && <span>ADVANCE REGISTER</span>}
              </Link>
              <Link href="/reports/expenses" className={subNavItemClass("/reports/expenses")} title="Detailed Expense Report">
                <FileSpreadsheet className="w-3.5 h-3.5 shrink-0" />
                {!isCollapsed && <span>DETAILED EXPENSE REPORT</span>}
              </Link>
              <Link
                href="/reports/category-analytics"
                className={subNavItemClass("/reports/category-analytics")}
                title="Category Analytics"
              >
                <PieChart className="w-3.5 h-3.5 shrink-0" />
                {!isCollapsed && <span>CATEGORY ANALYTICS</span>}
              </Link>
              <Link href="/reports/gst" className={subNavItemClass("/reports/gst")} title="GST Expense Register">
                <Percent className="w-3.5 h-3.5 shrink-0" />
                {!isCollapsed && <span>GST EXPENSE REGISTER</span>}
              </Link>
            </div>
          </div>
        )}

        {/* USER MANAGEMENT (ADMIN & SUPERADMIN ONLY) */}
        {hasAdminPrivileges && (
          <div className="space-y-1">
            {!isCollapsed && (
              <div className="px-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <Users className="w-3.5 h-3.5 text-emerald-400" />
                USER MANAGEMENT
              </div>
            )}
            <div className="pt-1 space-y-0.5">
              <Link
                href="/user-management?tab=requests"
                className={subNavItemClass("/user-management?tab=requests")}
                title="Access Requests"
              >
                <UserCheck className="w-3.5 h-3.5 shrink-0" />
                {!isCollapsed && <span>ACCESS REQUESTS</span>}
              </Link>
              <Link
                href="/user-management?tab=active"
                className={subNavItemClass("/user-management?tab=active")}
                title="Users"
              >
                <Users className="w-3.5 h-3.5 shrink-0" />
                {!isCollapsed && <span>USERS</span>}
              </Link>
            </div>
          </div>
        )}

        {/* MASTER MANAGEMENT (ADMIN & SUPERADMIN ONLY) */}
        {hasAdminPrivileges && (
          <div className="space-y-1">
            {!isCollapsed && (
              <div className="px-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <FolderTree className="w-3.5 h-3.5 text-amber-400" />
                MASTER MANAGEMENT
              </div>
            )}
            <div className="pt-1 space-y-0.5">
              <Link
                href="/master-management/categories"
                className={subNavItemClass("/master-management/categories")}
                title="Expense Categories"
              >
                <FolderTree className="w-3.5 h-3.5 shrink-0" />
                {!isCollapsed && <span>EXPENSE CATEGORIES</span>}
              </Link>
              <Link
                href="/master-management/gst"
                className={subNavItemClass("/master-management/gst")}
                title="GST Settings"
              >
                <Percent className="w-3.5 h-3.5 shrink-0" />
                {!isCollapsed && <span>GST SETTINGS</span>}
              </Link>
            </div>
          </div>
        )}

        {/* PROFILE */}
        <div>
          <Link href="/profile" className={navItemClass("/profile")} title="Profile">
            <User className="w-4 h-4 shrink-0" />
            {!isCollapsed && <span>PROFILE</span>}
          </Link>
        </div>
      </div>

      {/* Footer / User Profile & Logout */}
      <div className="p-3 border-t border-slate-800 bg-slate-950/50">
        <div className="flex items-center justify-between px-1 py-1">
          {!isCollapsed ? (
            <div className="min-w-0 flex-1 mr-2">
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
          ) : (
            <div className="mx-auto" title={`${userName} (${userRole})`}>
              {isSuperAdmin ? (
                <ShieldCheck className="w-4 h-4 text-amber-400" />
              ) : isAdmin ? (
                <Shield className="w-4 h-4 text-blue-400" />
              ) : (
                <User className="w-4 h-4 text-slate-400" />
              )}
            </div>
          )}
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-md transition-colors shrink-0"
            title="Sign Out"
            aria-label="Sign Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
