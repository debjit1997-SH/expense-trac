import { describe, it, expect } from "vitest";
import { generateExpenseSummaryPdf, ExpenseReportPdfData } from "../src/lib/pdf/pdf-generator";
import { ReportStatus, AdvanceStatus } from "@prisma/client";
import { getNormalizedAdvanceSummary } from "../src/lib/advance-summary";
import * as fs from "fs";
import * as path from "path";

describe("Visual Inspection: PDF Generation for SUBMITTED, APPROVED, and REIMBURSED", () => {
  const artifactScratchDir = "C:\\Users\\DEBJIT\\.gemini\\antigravity\\brain\\e5d60770-5db4-4da7-bc4c-1f4470e7af23\\scratch";

  const dummyAdvance = {
    id: "adv-123",
    advanceNumber: "ADV-2026-000006",
    purpose: "Business Travel to Mumbai",
    requestedAmount: 12000,
    approvedAmount: 12000,
    disbursedAmount: 12000,
    adjustedAmount: 0,
    returnedAmount: 0,
    reservedAmount: 9700,
    status: AdvanceStatus.DISBURSED,
    user: {
      name: "Debjit User",
      email: "userdebjit1612@gmail.com",
    },
  };

  const sampleItem = {
    serialNumber: 1,
    expenseDate: "25-Aug-2026",
    vendorName: "Taj Santacruz Hotel",
    invoiceNumber: "INV-2026-9901",
    invoiceDate: "25-Aug-2026",
    description: "Hotel stay during client onboarding visit",
    categoryName: "TRAVEL",
    subcategoryName: "ACCOMMODATION",
    totalAmount: 9700,
    taxableValue: 8220.34,
    totalGstAmount: 1479.66,
    cgstAmount: 739.83,
    sgstAmount: 739.83,
    igstAmount: 0,
    cessAmount: 0,
    gstRateLabel: "18%",
    vendorGstin: "27AABCT1234A1Z5",
    placeOfSupply: "27-Maharashtra",
  };

  it("generates SUBMITTED sample PDF with 10-column table within page bounds", async () => {
    const summary = getNormalizedAdvanceSummary({
      status: ReportStatus.SUBMITTED,
      totalAmount: 9700,
      advanceAllocation: {
        allocatedAmount: 9700,
        status: "RESERVED",
        advanceRequest: dummyAdvance,
      },
    });

    const data: ExpenseReportPdfData = {
      id: "rep-sub",
      reportNumber: "EXP-2026-000006",
      title: "Mumbai Client Onboarding Travel",
      workflowStatus: ReportStatus.SUBMITTED,
      versionNumber: 1,
      createdAt: "26-Aug-2026 10:00",
      submittedAt: "26-Aug-2026 11:30",
      currency: "INR",
      itemCount: 1,
      totalTaxableValue: 8220.34,
      totalCgst: 739.83,
      totalSgst: 739.83,
      totalIgst: 0,
      totalCess: 0,
      totalGst: 1479.66,
      grandTotal: 9700,
      advanceNumber: "ADV-2026-000006",
      advanceAdjustedAmount: 0,
      netPayableAmount: 0,
      advanceSummary: summary,
      submitter: {
        name: "Debjit User",
        email: "userdebjit1612@gmail.com",
        phone: "+91 9876543210",
        role: "USER",
      },
      workflow: {
        submittedBy: "Debjit User",
        submittedAt: "26-Aug-2026 11:30",
        primaryApprover: "Admin Debjit",
      },
      items: [sampleItem],
    };

    const pdfBytes = await generateExpenseSummaryPdf(data);
    expect(pdfBytes).toBeInstanceOf(Uint8Array);
    expect(pdfBytes.length).toBeGreaterThan(1000);

    const targetFile = path.join(artifactScratchDir, "sample-submitted.pdf");
    fs.writeFileSync(targetFile, Buffer.from(pdfBytes));
    expect(fs.existsSync(targetFile)).toBe(true);
  });

  it("generates APPROVED sample PDF with settled adjustment", async () => {
    const summary = getNormalizedAdvanceSummary({
      status: ReportStatus.APPROVED,
      totalAmount: 9700,
      advanceAdjustedAmount: 9700,
      netPayableAmount: 0,
      advanceAllocation: {
        allocatedAmount: 9700,
        status: "SETTLED",
        advanceRequest: {
          ...dummyAdvance,
          adjustedAmount: 9700,
          reservedAmount: 0,
          status: AdvanceStatus.PARTIALLY_SETTLED,
        },
      },
    });

    const data: ExpenseReportPdfData = {
      id: "rep-app",
      reportNumber: "EXP-2026-000006",
      title: "Mumbai Client Onboarding Travel",
      workflowStatus: ReportStatus.APPROVED,
      versionNumber: 2,
      createdAt: "26-Aug-2026 10:00",
      submittedAt: "26-Aug-2026 11:30",
      approvedAt: "26-Aug-2026 14:00",
      currency: "INR",
      itemCount: 1,
      totalTaxableValue: 8220.34,
      totalCgst: 739.83,
      totalSgst: 739.83,
      totalIgst: 0,
      totalCess: 0,
      totalGst: 1479.66,
      grandTotal: 9700,
      advanceNumber: "ADV-2026-000006",
      advanceAdjustedAmount: 9700,
      netPayableAmount: 0,
      advanceSummary: summary,
      submitter: {
        name: "Debjit User",
        email: "userdebjit1612@gmail.com",
        phone: "+91 9876543210",
        role: "USER",
      },
      workflow: {
        submittedBy: "Debjit User",
        submittedAt: "26-Aug-2026 11:30",
        primaryApprover: "Admin Debjit",
        approvedBy: "Admin Debjit",
        approvedAt: "26-Aug-2026 14:00",
        approvalNote: "Approved after invoice and hotel stay audit.",
        reimbursementOwner: "Debjit Dey",
      },
      items: [sampleItem],
    };

    const pdfBytes = await generateExpenseSummaryPdf(data);
    expect(pdfBytes.length).toBeGreaterThan(1000);

    const targetFile = path.join(artifactScratchDir, "sample-approved.pdf");
    fs.writeFileSync(targetFile, Buffer.from(pdfBytes));
    expect(fs.existsSync(targetFile)).toBe(true);
  });

  it("generates REIMBURSED sample PDF with zero-net settlement note", async () => {
    const summary = getNormalizedAdvanceSummary({
      status: ReportStatus.REIMBURSED,
      totalAmount: 9700,
      advanceAdjustedAmount: 9700,
      netPayableAmount: 0,
      advanceAllocation: {
        allocatedAmount: 9700,
        status: "SETTLED",
        advanceRequest: {
          ...dummyAdvance,
          adjustedAmount: 9700,
          reservedAmount: 0,
          status: AdvanceStatus.PARTIALLY_SETTLED,
        },
      },
    });

    const data: ExpenseReportPdfData = {
      id: "rep-reimb",
      reportNumber: "EXP-2026-000006",
      title: "Mumbai Client Onboarding Travel",
      workflowStatus: ReportStatus.REIMBURSED,
      versionNumber: 3,
      createdAt: "26-Aug-2026 10:00",
      submittedAt: "26-Aug-2026 11:30",
      approvedAt: "26-Aug-2026 14:00",
      reimbursedAt: "27-Aug-2026 15:30",
      currency: "INR",
      itemCount: 1,
      totalTaxableValue: 8220.34,
      totalCgst: 739.83,
      totalSgst: 739.83,
      totalIgst: 0,
      totalCess: 0,
      totalGst: 1479.66,
      grandTotal: 9700,
      advanceNumber: "ADV-2026-000006",
      advanceAdjustedAmount: 9700,
      netPayableAmount: 0,
      advanceSummary: summary,
      submitter: {
        name: "Debjit User",
        email: "userdebjit1612@gmail.com",
        phone: "+91 9876543210",
        role: "USER",
      },
      workflow: {
        submittedBy: "Debjit User",
        submittedAt: "26-Aug-2026 11:30",
        primaryApprover: "Admin Debjit",
        approvedBy: "Admin Debjit",
        approvedAt: "26-Aug-2026 14:00",
        approvalNote: "Approved after invoice audit.",
        reimbursementOwner: "Debjit Dey",
        reimbursedBy: "Debjit Dey",
        reimbursedAt: "27-Aug-2026 15:30",
        paymentMethod: "ZERO_NET_ADVANCE_ADJUSTMENT",
        reimbursementRef: "ADV-ADJ-2026-000006",
        reimbursementNote: "Zero net payable: Fully adjusted against company advance ADV-2026-000006.",
      },
      items: [sampleItem],
    };

    const pdfBytes = await generateExpenseSummaryPdf(data);
    expect(pdfBytes.length).toBeGreaterThan(1000);

    const targetFile = path.join(artifactScratchDir, "sample-reimbursed.pdf");
    fs.writeFileSync(targetFile, Buffer.from(pdfBytes));
    expect(fs.existsSync(targetFile)).toBe(true);
  });
});
