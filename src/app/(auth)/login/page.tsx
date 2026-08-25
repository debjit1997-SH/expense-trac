"use client";

import React, { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { requestAccessAction } from "@/actions/auth.actions";
import { CreditCard, Lock, Mail, Phone, User, CheckCircle2, AlertCircle } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();

  // Login Form States
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Request Access Modal States
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [reqName, setReqName] = useState("");
  const [reqPhone, setReqPhone] = useState("");
  const [reqEmail, setReqEmail] = useState("");
  const [reqPassword, setReqPassword] = useState("");
  const [reqConfirmPassword, setReqConfirmPassword] = useState("");
  const [requestError, setRequestError] = useState<string | null>(null);
  const [requestSuccess, setRequestSuccess] = useState<string | null>(null);
  const [isRequesting, setIsRequesting] = useState(false);

  // Forgot Password placeholder state
  const [showForgotModal, setShowForgotModal] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setIsLoggingIn(true);

    try {
      const res = await signIn("credentials", {
        redirect: false,
        email: email.toLowerCase().trim(),
        password,
      });

      if (res?.error) {
        setLoginError(res.error);
      } else {
        router.push("/dashboard");
        router.refresh();
      }
    } catch (err: any) {
      setLoginError(err.message || "An unexpected error occurred during login.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleRequestAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    setRequestError(null);
    setRequestSuccess(null);

    if (reqPassword !== reqConfirmPassword) {
      setRequestError("Password and Confirm Password do not match.");
      return;
    }

    try {
      setIsRequesting(true);
      const res = await requestAccessAction({
        name: reqName,
        phone: reqPhone,
        email: reqEmail,
        password: reqPassword,
        confirmPassword: reqConfirmPassword,
      });

      if (!res.success) {
        setRequestError(res.error || "Failed to submit request.");
      } else {
        setRequestSuccess(
          res.message || "Your access request has been submitted successfully."
        );
        // Clear fields
        setReqName("");
        setReqPhone("");
        setReqEmail("");
        setReqPassword("");
        setReqConfirmPassword("");
      }
    } catch (err: any) {
      setRequestError(err.message || "An unexpected error occurred.");
    } finally {
      setIsRequesting(false);
    }
  };

  return (
    <div className="w-full max-w-md space-y-6">
      {/* Header Logo */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-500/20">
          <CreditCard className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-black tracking-tight text-white uppercase">
          Expense Management
        </h1>
        <p className="text-xs text-slate-400">
          Official Office Reimbursement &amp; Expense Portal
        </p>
      </div>

      {/* Login Card */}
      <Card className="border-slate-700 bg-slate-800/90 backdrop-blur-sm text-slate-100 shadow-2xl">
        <CardHeader className="border-b border-slate-700/60 pb-4">
          <CardTitle className="text-lg font-bold text-white">Sign In</CardTitle>
          <CardDescription className="text-xs text-slate-400">
            Enter your company credentials to access your account
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <form onSubmit={handleLogin} className="space-y-4">
            {loginError && (
              <div className="p-3 rounded-md bg-red-950/60 border border-red-800 text-xs text-red-300 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <span>{loginError}</span>
              </div>
            )}

            <Input
              label="Email Address"
              type="email"
              placeholder="name@company.com"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-slate-900 border-slate-700 text-white placeholder:text-slate-500"
            />

            <div className="space-y-1.5">
              <Input
                label="Password"
                type="password"
                placeholder="••••••••"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-slate-900 border-slate-700 text-white placeholder:text-slate-500"
              />
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowForgotModal(true)}
                  className="text-[11px] text-blue-400 hover:text-blue-300 font-medium hover:underline"
                >
                  Forgot Password?
                </button>
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              className="w-full h-11 text-sm font-semibold bg-blue-600 hover:bg-blue-500"
              isLoading={isLoggingIn}
            >
              Sign In
            </Button>
          </form>

          {/* Request Access Link */}
          <div className="mt-6 pt-4 border-t border-slate-700/60 text-center">
            <p className="text-xs text-slate-400">
              Don&apos;t have access yet?{" "}
              <button
                type="button"
                onClick={() => {
                  setRequestError(null);
                  setRequestSuccess(null);
                  setIsRequestModalOpen(true);
                }}
                className="text-blue-400 hover:text-blue-300 font-semibold underline underline-offset-4 ml-1"
              >
                Request Access
              </button>
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Request Access Modal */}
      <Modal
        isOpen={isRequestModalOpen}
        onClose={() => setIsRequestModalOpen(false)}
        title="Request System Access"
        description="Submit your details to request an account. An administrator will review your request."
        maxWidth="lg"
      >
        {requestSuccess ? (
          <div className="py-6 text-center space-y-4">
            <div className="inline-flex p-3 rounded-full bg-emerald-100 text-emerald-600">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div>
              <h4 className="text-base font-bold text-slate-900">Request Submitted!</h4>
              <p className="text-xs text-slate-600 mt-1 max-w-sm mx-auto">
                {requestSuccess}
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => setIsRequestModalOpen(false)}
              className="mt-4 text-xs font-semibold"
            >
              Back to Login
            </Button>
          </div>
        ) : (
          <form onSubmit={handleRequestAccess} className="space-y-4 pt-2">
            {requestError && (
              <div className="p-3 rounded-md bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>{requestError}</span>
              </div>
            )}

            <Input
              label="Full Name"
              required
              placeholder="e.g. Rahul Sharma"
              value={reqName}
              onChange={(e) => setReqName(e.target.value)}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Phone Number"
                required
                placeholder="+91 9876543210"
                value={reqPhone}
                onChange={(e) => setReqPhone(e.target.value)}
              />
              <Input
                label="Email Address"
                type="email"
                required
                placeholder="rahul@company.com"
                value={reqEmail}
                onChange={(e) => setReqEmail(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Password"
                type="password"
                required
                placeholder="Min 8 chars, 1 upper, 1 number"
                value={reqPassword}
                onChange={(e) => setReqPassword(e.target.value)}
              />
              <Input
                label="Confirm Password"
                type="password"
                required
                placeholder="Re-enter password"
                value={reqConfirmPassword}
                onChange={(e) => setReqConfirmPassword(e.target.value)}
              />
            </div>

            <p className="text-[11px] text-slate-500 italic">
              Note: Public applicants cannot choose an account role. Your role will be assigned by the administrator upon approval.
            </p>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsRequestModalOpen(false)}
                disabled={isRequesting}
              >
                Cancel
              </Button>
              <Button type="submit" variant="primary" isLoading={isRequesting}>
                Submit Access Request
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Forgot Password Placeholder Modal */}
      <Modal
        isOpen={showForgotModal}
        onClose={() => setShowForgotModal(false)}
        title="Password Reset"
        maxWidth="sm"
      >
        <div className="space-y-4 text-center py-4">
          <Lock className="w-10 h-10 text-slate-400 mx-auto" />
          <div>
            <h4 className="text-sm font-bold text-slate-800">Self-Service Reset in Future Phase</h4>
            <p className="text-xs text-slate-500 mt-1">
              Please contact your system administrator to reset your account password.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowForgotModal(false)}>
            Close
          </Button>
        </div>
      </Modal>
    </div>
  );
}
