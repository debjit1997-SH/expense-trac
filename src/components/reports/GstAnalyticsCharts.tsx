"use client";

import React, { useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { GstAnalyticsData } from "@/lib/reports/gst-register-query";
import { formatCurrencyINR } from "@/lib/formatters";
import {
  Percent,
  Layers,
  Store,
  ArrowDownUp,
  Ban,
  CheckCircle2,
  Calendar,
} from "lucide-react";

const ITC_COLORS: Record<string, string> = {
  ELIGIBLE: "#10B981", // Emerald
  INELIGIBLE: "#EF4444", // Red
  PENDING_REVIEW: "#F59E0B", // Amber
  NOT_APPLICABLE: "#94A3B8", // Slate
};

interface GstAnalyticsChartsProps {
  analytics: GstAnalyticsData;
}

export function GstAnalyticsCharts({ analytics }: GstAnalyticsChartsProps) {
  const [activeTab, setActiveTab] = useState<"TRENDS" | "COMPONENTS" | "CATEGORIES" | "VENDORS" | "RCM" | "NONGST">("TRENDS");

  const { monthlyTrend, taxComponents, ratesBreakdown, itcBreakdown, categoriesSummary, vendorsSummary, rcmTransactions, nonGstTransactions } = analytics;

  const CustomCurrencyTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-900 text-white p-2.5 rounded-md text-xs shadow-lg space-y-1">
          {label && <p className="font-bold text-slate-200 border-b border-slate-700 pb-1">{label}</p>}
          {payload.map((p: any) => (
            <div key={p.name} className="flex items-center justify-between gap-3 text-[11px]">
              <span style={{ color: p.color || p.fill }}>{p.name}:</span>
              <span className="font-mono font-bold text-slate-100">{formatCurrencyINR(p.value)}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-4 space-y-4">
      {/* Sub-Navigation Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2.5">
        <div className="flex flex-wrap items-center gap-1">
          {[
            { key: "TRENDS", label: "Monthly GST Trend", icon: Calendar },
            { key: "COMPONENTS", label: "Tax Components & ITC", icon: Percent },
            { key: "CATEGORIES", label: "GST by Category", icon: Layers },
            { key: "VENDORS", label: "Top GST Vendors", icon: Store },
            { key: "RCM", label: `RCM (${rcmTransactions.length})`, icon: ArrowDownUp },
            { key: "NONGST", label: `Non-GST (${nonGstTransactions.length})`, icon: Ban },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key as any)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                  isActive
                    ? "bg-blue-600 text-white shadow-xs"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* TAB 1: Monthly GST Trend */}
      {activeTab === "TRENDS" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
              Monthly GST Tax Stacked Trend (CGST, SGST, IGST, Cess)
            </h3>
          </div>

          <div className="h-[320px] w-full">
            {monthlyTrend.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs italic">
                No monthly trend data available.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyTrend} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="monthLabel" tick={{ fontSize: 11, fill: "#64748B" }} tickLine={false} />
                  <YAxis
                    tick={{ fontSize: 10, fill: "#64748B" }}
                    tickFormatter={(val) => `₹${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<CustomCurrencyTooltip />} />
                  <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
                  <Bar dataKey="cgst" name="CGST" stackId="a" fill="#3B82F6" />
                  <Bar dataKey="sgst" name="SGST / UTGST" stackId="a" fill="#10B981" />
                  <Bar dataKey="igst" name="IGST" stackId="a" fill="#8B5CF6" />
                  <Bar dataKey="cess" name="Cess" stackId="a" fill="#F59E0B" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: Tax Components & ITC */}
      {activeTab === "COMPONENTS" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Tax Components Donut */}
          <div className="border border-slate-100 rounded-lg p-3 space-y-2">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              GST by Tax Component
            </h4>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={taxComponents}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    dataKey="amount"
                    nameKey="component"
                  >
                    {taxComponents.map((entry, idx) => (
                      <Cell key={`cell-${idx}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomCurrencyTooltip />} />
                  <Legend wrapperStyle={{ fontSize: "11px" }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* ITC Eligibility Donut */}
          <div className="border border-slate-100 rounded-lg p-3 space-y-2">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Input Tax Credit (ITC) Classification
            </h4>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={itcBreakdown}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    dataKey="itcAmount"
                    nameKey="label"
                  >
                    {itcBreakdown.map((entry) => (
                      <Cell
                        key={entry.eligibility}
                        fill={ITC_COLORS[entry.eligibility] || "#94A3B8"}
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomCurrencyTooltip />} />
                  <Legend wrapperStyle={{ fontSize: "11px" }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* GST Rates Bar */}
          <div className="md:col-span-2 border border-slate-100 rounded-lg p-3 space-y-2">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              GST Tax &amp; Taxable Value by Slab Rate
            </h4>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ratesBreakdown} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="rateLabel" tick={{ fontSize: 11, fill: "#64748B" }} tickLine={false} />
                  <YAxis
                    tick={{ fontSize: 10, fill: "#64748B" }}
                    tickFormatter={(val) => `₹${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<CustomCurrencyTooltip />} />
                  <Legend wrapperStyle={{ fontSize: "11px" }} />
                  <Bar dataKey="taxableValue" name="Taxable Value" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="totalGst" name="Total GST" fill="#10B981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Categories */}
      {activeTab === "CATEGORIES" && (
        <div className="border border-slate-200 rounded-lg overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse divide-y divide-slate-200">
            <thead className="bg-slate-900 text-white">
              <tr>
                <th className="p-2.5 font-bold uppercase tracking-wider text-[11px]">Category</th>
                <th className="p-2.5 font-bold uppercase tracking-wider text-[11px] text-center">Items</th>
                <th className="p-2.5 font-bold uppercase tracking-wider text-[11px] text-right">Taxable Value</th>
                <th className="p-2.5 font-bold uppercase tracking-wider text-[11px] text-right">CGST</th>
                <th className="p-2.5 font-bold uppercase tracking-wider text-[11px] text-right">SGST</th>
                <th className="p-2.5 font-bold uppercase tracking-wider text-[11px] text-right">IGST</th>
                <th className="p-2.5 font-bold uppercase tracking-wider text-[11px] text-right">Total GST</th>
                <th className="p-2.5 font-bold uppercase tracking-wider text-[11px] text-right">Gross Spend</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {categoriesSummary.map((c, idx) => (
                <tr key={c.categoryName} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50/50"}>
                  <td className="p-2.5 font-bold text-slate-900">{c.categoryName}</td>
                  <td className="p-2.5 text-center font-mono">{c.itemCount}</td>
                  <td className="p-2.5 text-right font-mono">{formatCurrencyINR(c.taxableValue)}</td>
                  <td className="p-2.5 text-right font-mono">{formatCurrencyINR(c.cgst)}</td>
                  <td className="p-2.5 text-right font-mono">{formatCurrencyINR(c.sgst)}</td>
                  <td className="p-2.5 text-right font-mono">{formatCurrencyINR(c.igst)}</td>
                  <td className="p-2.5 text-right font-mono font-bold text-emerald-700">{formatCurrencyINR(c.totalGst)}</td>
                  <td className="p-2.5 text-right font-mono font-bold text-slate-900">{formatCurrencyINR(c.grossAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 4: Vendors */}
      {activeTab === "VENDORS" && (
        <div className="border border-slate-200 rounded-lg overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse divide-y divide-slate-200">
            <thead className="bg-slate-900 text-white">
              <tr>
                <th className="p-2.5 font-bold uppercase tracking-wider text-[11px]">Vendor Name</th>
                <th className="p-2.5 font-bold uppercase tracking-wider text-[11px]">Vendor GSTIN</th>
                <th className="p-2.5 font-bold uppercase tracking-wider text-[11px] text-center">Items</th>
                <th className="p-2.5 font-bold uppercase tracking-wider text-[11px] text-right">Taxable Value</th>
                <th className="p-2.5 font-bold uppercase tracking-wider text-[11px] text-right">Total GST</th>
                <th className="p-2.5 font-bold uppercase tracking-wider text-[11px] text-right">Gross Spend</th>
                <th className="p-2.5 font-bold uppercase tracking-wider text-[11px] text-center">Audit Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {vendorsSummary.map((v, idx) => (
                <tr key={`${v.vendorName}-${v.vendorGstin}`} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50/50"}>
                  <td className="p-2.5 font-bold text-slate-900">{v.vendorName}</td>
                  <td className="p-2.5 font-mono text-slate-600">{v.vendorGstin}</td>
                  <td className="p-2.5 text-center font-mono">{v.itemCount}</td>
                  <td className="p-2.5 text-right font-mono">{formatCurrencyINR(v.taxableValue)}</td>
                  <td className="p-2.5 text-right font-mono font-bold text-emerald-700">{formatCurrencyINR(v.totalGst)}</td>
                  <td className="p-2.5 text-right font-mono font-bold text-slate-900">{formatCurrencyINR(v.grossAmount)}</td>
                  <td className="p-2.5 text-center">
                    {v.hasExceptions ? (
                      <span className="px-2 py-0.5 rounded bg-red-100 text-red-800 text-[10px] font-bold">
                        ⚠️ Exceptions
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                        ✓ Verified
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 5: RCM */}
      {activeTab === "RCM" && (
        <div className="space-y-3">
          <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-md text-xs text-indigo-900">
            <span className="font-bold">Reverse Charge Mechanism (RCM):</span> Inward supplies where the recipient company is liable to discharge GST directly to the government.
          </div>
          <div className="border border-slate-200 rounded-lg overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse divide-y divide-slate-200">
              <thead className="bg-slate-900 text-white">
                <tr>
                  <th className="p-2.5 font-bold uppercase tracking-wider text-[11px]">Report #</th>
                  <th className="p-2.5 font-bold uppercase tracking-wider text-[11px]">Date</th>
                  <th className="p-2.5 font-bold uppercase tracking-wider text-[11px]">Vendor Name</th>
                  <th className="p-2.5 font-bold uppercase tracking-wider text-[11px]">Place of Supply</th>
                  <th className="p-2.5 font-bold uppercase tracking-wider text-[11px] text-right">Taxable Value</th>
                  <th className="p-2.5 font-bold uppercase tracking-wider text-[11px] text-right">GST Amount</th>
                  <th className="p-2.5 font-bold uppercase tracking-wider text-[11px] text-right">Gross Spend</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {rcmTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400 italic">
                      No Reverse Charge (RCM) transactions found in the active filter period.
                    </td>
                  </tr>
                ) : (
                  rcmTransactions.map((r, idx) => (
                    <tr key={r.itemId} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50/50"}>
                      <td className="p-2.5 font-mono font-bold text-slate-900">{r.reportNumber}</td>
                      <td className="p-2.5 text-slate-700">{r.expenseDate}</td>
                      <td className="p-2.5 font-semibold text-slate-900">{r.vendorName}</td>
                      <td className="p-2.5 text-slate-700">{r.placeOfSupply || "-"}</td>
                      <td className="p-2.5 text-right font-mono">{formatCurrencyINR(r.taxableValue)}</td>
                      <td className="p-2.5 text-right font-mono font-bold text-indigo-700">{formatCurrencyINR(r.totalGstAmount)}</td>
                      <td className="p-2.5 text-right font-mono font-bold text-slate-900">{formatCurrencyINR(r.grossAmount)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 6: Non-GST */}
      {activeTab === "NONGST" && (
        <div className="space-y-3">
          <div className="p-3 bg-slate-100 border border-slate-200 rounded-md text-xs text-slate-700">
            <span className="font-bold">Non-GST / Exempt / Nil-Rated:</span> Inward expenses where GST is 0% or marked non-taxable / outside GST scope.
          </div>
          <div className="border border-slate-200 rounded-lg overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse divide-y divide-slate-200">
              <thead className="bg-slate-900 text-white">
                <tr>
                  <th className="p-2.5 font-bold uppercase tracking-wider text-[11px]">Report #</th>
                  <th className="p-2.5 font-bold uppercase tracking-wider text-[11px]">Date</th>
                  <th className="p-2.5 font-bold uppercase tracking-wider text-[11px]">Vendor Name</th>
                  <th className="p-2.5 font-bold uppercase tracking-wider text-[11px]">GST Treatment</th>
                  <th className="p-2.5 font-bold uppercase tracking-wider text-[11px]">Category</th>
                  <th className="p-2.5 font-bold uppercase tracking-wider text-[11px] text-right">Gross Spend</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {nonGstTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400 italic">
                      No Non-GST/Exempt expenses found in the active filter period.
                    </td>
                  </tr>
                ) : (
                  nonGstTransactions.map((r, idx) => (
                    <tr key={r.itemId} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50/50"}>
                      <td className="p-2.5 font-mono font-bold text-slate-900">{r.reportNumber}</td>
                      <td className="p-2.5 text-slate-700">{r.expenseDate}</td>
                      <td className="p-2.5 font-semibold text-slate-900">{r.vendorName}</td>
                      <td className="p-2.5 text-slate-600">{r.gstTreatmentName}</td>
                      <td className="p-2.5 text-slate-700">{r.categoryName}</td>
                      <td className="p-2.5 text-right font-mono font-bold text-slate-900">{formatCurrencyINR(r.grossAmount)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
