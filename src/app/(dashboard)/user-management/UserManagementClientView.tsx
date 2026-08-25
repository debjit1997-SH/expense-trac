"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Role, AccountStatus } from "@prisma/client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { DateDisplay } from "@/components/common/DateDisplay";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import {
  approveAccessRequestAction,
  rejectAccessRequestAction,
  deactivateUserAction,
  activateUserAction,
  updateUserRoleAction,
} from "@/actions/user-management.actions";
import {
  UserCheck,
  Users,
  UserX,
  ShieldAlert,
  Shield,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Clock,
  Phone,
  Mail,
} from "lucide-react";

interface UserItem {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: Role;
  status: AccountStatus;
  rejectionReason?: string | null;
  createdAt: Date | string;
  updatedAt?: Date | string;
  accessHistories?: any[];
}

interface UserManagementClientViewProps {
  currentUserId: string;
  currentUserRole: Role;
  defaultTab: string;
  initialPending: UserItem[];
  initialActive: UserItem[];
  initialRejected: UserItem[];
  initialDisabled: UserItem[];
}

export function UserManagementClientView({
  currentUserId,
  currentUserRole,
  defaultTab,
  initialPending,
  initialActive,
  initialRejected,
  initialDisabled,
}: UserManagementClientViewProps) {
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<"requests" | "active" | "rejected" | "disabled">(
    defaultTab === "active"
      ? "active"
      : defaultTab === "rejected"
      ? "rejected"
      : defaultTab === "disabled"
      ? "disabled"
      : "requests"
  );

  // Assigned role maps for pending users
  const [selectedRoles, setSelectedRoles] = useState<Record<string, Role>>({});

  // Action / Dialog States
  const [isProcessing, setIsProcessing] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [rejectCandidate, setRejectCandidate] = useState<UserItem | null>(null);
  const [deactivateCandidate, setDeactivateCandidate] = useState<UserItem | null>(null);
  const [activateCandidate, setActivateCandidate] = useState<UserItem | null>(null);

  const isSuperAdmin = currentUserRole === Role.SUPERADMIN;

  const getRoleBadge = (role: Role) => {
    switch (role) {
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
            USER
          </Badge>
        );
    }
  };

  // Handlers
  const handleApprove = async (user: UserItem) => {
    const assignedRole = selectedRoles[user.id] || Role.USER;
    try {
      setIsProcessing(true);
      setErrorMessage(null);
      setSuccessMessage(null);

      const res = await approveAccessRequestAction({
        userId: user.id,
        role: assignedRole,
      });

      if (!res.success) {
        setErrorMessage(res.error || "Failed to approve request.");
      } else {
        setSuccessMessage(`Access approved for ${user.name} with role ${assignedRole}.`);
        router.refresh();
      }
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmReject = async (reason?: string) => {
    if (!rejectCandidate) return;
    try {
      setIsProcessing(true);
      setErrorMessage(null);
      setSuccessMessage(null);

      const res = await rejectAccessRequestAction({
        userId: rejectCandidate.id,
        reason,
      });

      if (!res.success) {
        setErrorMessage(res.error || "Failed to reject request.");
      } else {
        setSuccessMessage(`Access request for ${rejectCandidate.name} has been rejected.`);
        setRejectCandidate(null);
        router.refresh();
      }
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmDeactivate = async (reason?: string) => {
    if (!deactivateCandidate) return;
    try {
      setIsProcessing(true);
      setErrorMessage(null);
      setSuccessMessage(null);

      const res = await deactivateUserAction({
        userId: deactivateCandidate.id,
        reason,
      });

      if (!res.success) {
        setErrorMessage(res.error || "Failed to deactivate user.");
      } else {
        setSuccessMessage(`User ${deactivateCandidate.name} deactivated successfully.`);
        setDeactivateCandidate(null);
        router.refresh();
      }
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmActivate = async (reason?: string) => {
    if (!activateCandidate) return;
    try {
      setIsProcessing(true);
      setErrorMessage(null);
      setSuccessMessage(null);

      const res = await activateUserAction({
        userId: activateCandidate.id,
        reason,
      });

      if (!res.success) {
        setErrorMessage(res.error || "Failed to activate user.");
      } else {
        setSuccessMessage(`User ${activateCandidate.name} re-activated successfully.`);
        setActivateCandidate(null);
        router.refresh();
      }
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: Role) => {
    try {
      setIsProcessing(true);
      setErrorMessage(null);
      setSuccessMessage(null);

      const res = await updateUserRoleAction({
        userId,
        role: newRole,
      });

      if (!res.success) {
        setErrorMessage(res.error || "Failed to update role.");
      } else {
        setSuccessMessage("User role updated successfully.");
        router.refresh();
      }
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="flex border-b border-slate-200 gap-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab("requests")}
          className={`py-3 px-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
            activeTab === "requests"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <UserCheck className="w-4 h-4" />
          ACCESS REQUESTS ({initialPending.length})
        </button>

        <button
          onClick={() => setActiveTab("active")}
          className={`py-3 px-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
            activeTab === "active"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <Users className="w-4 h-4" />
          ACTIVE USERS ({initialActive.length})
        </button>

        <button
          onClick={() => setActiveTab("rejected")}
          className={`py-3 px-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
            activeTab === "rejected"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <UserX className="w-4 h-4" />
          REJECTED REQUESTS ({initialRejected.length})
        </button>

        <button
          onClick={() => setActiveTab("disabled")}
          className={`py-3 px-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
            activeTab === "disabled"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <ShieldAlert className="w-4 h-4" />
          DISABLED USERS ({initialDisabled.length})
        </button>
      </div>

      {/* Messages */}
      {successMessage && (
        <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* TAB 1: ACCESS REQUESTS */}
      {activeTab === "requests" && (
        <Card className="shadow-sm">
          <CardHeader className="py-4 bg-slate-50/70 border-b border-slate-200">
            <CardTitle className="text-sm font-bold text-slate-800">
              Pending Applicant Requests ({initialPending.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {initialPending.length === 0 ? (
              <div className="p-12 text-center text-xs text-slate-500">
                No pending access requests awaiting review.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs font-bold text-slate-600 uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Applicant Name</th>
                      <th className="py-3 px-4">Contact Info</th>
                      <th className="py-3 px-4">Requested On</th>
                      <th className="py-3 px-4">Assign Role</th>
                      <th className="py-3 px-4 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {initialPending.map((user) => (
                      <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3.5 px-4 font-semibold text-slate-900">
                          {user.name}
                        </td>
                        <td className="py-3.5 px-4 text-xs space-y-0.5">
                          <div className="flex items-center gap-1.5 text-slate-700">
                            <Mail className="w-3 h-3 text-slate-400" />
                            {user.email}
                          </div>
                          <div className="flex items-center gap-1.5 text-slate-500">
                            <Phone className="w-3 h-3 text-slate-400" />
                            {user.phone}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-xs text-slate-500 whitespace-nowrap">
                          <DateDisplay date={user.createdAt} />
                        </td>
                        <td className="py-3.5 px-4">
                          <select
                            value={selectedRoles[user.id] || "USER"}
                            onChange={(e) =>
                              setSelectedRoles((prev) => ({
                                ...prev,
                                [user.id]: e.target.value as Role,
                              }))
                            }
                            className="text-xs font-semibold py-1.5 px-2.5 border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="USER">USER (Standard Employee)</option>
                            <option value="ADMIN">ADMIN (Operations Reviewer)</option>
                            {isSuperAdmin && (
                              <option value="SUPERADMIN">SUPERADMIN (Full Access)</option>
                            )}
                          </select>
                        </td>
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center space-x-2">
                            <Button
                              size="sm"
                              variant="success"
                              onClick={() => handleApprove(user)}
                              disabled={isProcessing}
                              className="text-xs h-7 px-3 bg-emerald-600 hover:bg-emerald-700"
                            >
                              Accept
                            </Button>
                            <Button
                              size="sm"
                              variant="danger"
                              onClick={() => setRejectCandidate(user)}
                              disabled={isProcessing}
                              className="text-xs h-7 px-3 bg-red-600 hover:bg-red-700"
                            >
                              Reject
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* TAB 2: ACTIVE USERS */}
      {activeTab === "active" && (
        <Card className="shadow-sm">
          <CardHeader className="py-4 bg-slate-50/70 border-b border-slate-200">
            <CardTitle className="text-sm font-bold text-slate-800">
              Active Authorized Users ({initialActive.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs font-bold text-slate-600 uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">User Name</th>
                    <th className="py-3 px-4">Contact Info</th>
                    <th className="py-3 px-4">Current Role</th>
                    <th className="py-3 px-4">Member Since</th>
                    <th className="py-3 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {initialActive.map((user) => {
                    const isSelf = user.id === currentUserId;
                    const isTargetSuper = user.role === Role.SUPERADMIN;
                    const canModifyRole =
                      !isSelf && (isSuperAdmin || (!isTargetSuper && currentUserRole === Role.ADMIN));
                    const canDeactivate =
                      !isSelf && (isSuperAdmin || (!isTargetSuper && currentUserRole === Role.ADMIN));

                    return (
                      <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3.5 px-4 font-semibold text-slate-900">
                          {user.name}
                          {isSelf && (
                            <span className="ml-2 text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded font-mono font-bold">
                              YOU
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-xs space-y-0.5">
                          <div className="text-slate-700">{user.email}</div>
                          <div className="text-slate-500">{user.phone}</div>
                        </td>
                        <td className="py-3.5 px-4">
                          {canModifyRole ? (
                            <select
                              value={user.role}
                              onChange={(e) => handleRoleChange(user.id, e.target.value as Role)}
                              disabled={isProcessing}
                              className="text-xs font-semibold py-1.5 px-2 border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              <option value="USER">USER</option>
                              <option value="ADMIN">ADMIN</option>
                              {isSuperAdmin && <option value="SUPERADMIN">SUPERADMIN</option>}
                            </select>
                          ) : (
                            getRoleBadge(user.role)
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-xs text-slate-500 whitespace-nowrap">
                          <DateDisplay date={user.createdAt} />
                        </td>
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          {canDeactivate ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setDeactivateCandidate(user)}
                              className="text-xs h-7 px-2.5 border-red-200 text-red-700 hover:bg-red-50"
                            >
                              Deactivate Access
                            </Button>
                          ) : (
                            <span className="text-xs text-slate-400 italic">Protected</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* TAB 3: REJECTED REQUESTS */}
      {activeTab === "rejected" && (
        <Card className="shadow-sm">
          <CardHeader className="py-4 bg-slate-50/70 border-b border-slate-200">
            <CardTitle className="text-sm font-bold text-slate-800">
              Rejected Access Requests ({initialRejected.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {initialRejected.length === 0 ? (
              <div className="p-12 text-center text-xs text-slate-500">
                No rejected access requests recorded.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs font-bold text-slate-600 uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Applicant Name</th>
                      <th className="py-3 px-4">Contact Info</th>
                      <th className="py-3 px-4">Rejection Reason</th>
                      <th className="py-3 px-4">Date Rejected</th>
                      <th className="py-3 px-4 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {initialRejected.map((user) => (
                      <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3.5 px-4 font-semibold text-slate-900">{user.name}</td>
                        <td className="py-3.5 px-4 text-xs space-y-0.5">
                          <div className="text-slate-700">{user.email}</div>
                          <div className="text-slate-500">{user.phone}</div>
                        </td>
                        <td className="py-3.5 px-4 text-xs text-slate-600 italic">
                          {user.rejectionReason || "No reason specified"}
                        </td>
                        <td className="py-3.5 px-4 text-xs text-slate-500 whitespace-nowrap">
                          <DateDisplay date={user.updatedAt} />
                        </td>
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleApprove(user)}
                            className="text-xs h-7 px-2.5 text-blue-700 border-blue-200 hover:bg-blue-50"
                          >
                            Re-evaluate &amp; Accept
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* TAB 4: DISABLED USERS */}
      {activeTab === "disabled" && (
        <Card className="shadow-sm">
          <CardHeader className="py-4 bg-slate-50/70 border-b border-slate-200">
            <CardTitle className="text-sm font-bold text-slate-800">
              Deactivated / Disabled Accounts ({initialDisabled.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {initialDisabled.length === 0 ? (
              <div className="p-12 text-center text-xs text-slate-500">
                No disabled user accounts.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs font-bold text-slate-600 uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4">User Name</th>
                      <th className="py-3 px-4">Contact Info</th>
                      <th className="py-3 px-4">Previous Role</th>
                      <th className="py-3 px-4">Deactivated Date</th>
                      <th className="py-3 px-4 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {initialDisabled.map((user) => (
                      <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3.5 px-4 font-semibold text-slate-900">{user.name}</td>
                        <td className="py-3.5 px-4 text-xs space-y-0.5">
                          <div className="text-slate-700">{user.email}</div>
                          <div className="text-slate-500">{user.phone}</div>
                        </td>
                        <td className="py-3.5 px-4">{getRoleBadge(user.role)}</td>
                        <td className="py-3.5 px-4 text-xs text-slate-500 whitespace-nowrap">
                          <DateDisplay date={user.updatedAt} />
                        </td>
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          <Button
                            size="sm"
                            variant="success"
                            onClick={() => setActivateCandidate(user)}
                            className="text-xs h-7 px-3 bg-emerald-600 hover:bg-emerald-700"
                          >
                            Re-activate Access
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Reject Modal */}
      <ConfirmDialog
        isOpen={Boolean(rejectCandidate)}
        onClose={() => setRejectCandidate(null)}
        onConfirm={handleConfirmReject}
        title="Reject Access Request"
        message={`Are you sure you want to reject the registration request from ${rejectCandidate?.name} (${rejectCandidate?.email})?`}
        confirmLabel="Reject Request"
        variant="danger"
        askReason={true}
        reasonPlaceholder="Optional reason for rejection..."
        isLoading={isProcessing}
      />

      {/* Deactivate Modal */}
      <ConfirmDialog
        isOpen={Boolean(deactivateCandidate)}
        onClose={() => setDeactivateCandidate(null)}
        onConfirm={handleConfirmDeactivate}
        title="Deactivate User Access"
        message={`Are you sure you want to deactivate ${deactivateCandidate?.name}? Their account will be disabled immediately, but all historical financial records and reimbursement logs will remain intact.`}
        confirmLabel="Deactivate Account"
        variant="danger"
        askReason={true}
        reasonPlaceholder="Optional reason for deactivation..."
        isLoading={isProcessing}
      />

      {/* Re-activate Modal */}
      <ConfirmDialog
        isOpen={Boolean(activateCandidate)}
        onClose={() => setActivateCandidate(null)}
        onConfirm={handleConfirmActivate}
        title="Re-activate User Access"
        message={`Are you sure you want to restore access for ${activateCandidate?.name}?`}
        confirmLabel="Activate Account"
        variant="success"
        askReason={true}
        reasonPlaceholder="Optional remarks..."
        isLoading={isProcessing}
      />
    </div>
  );
}
