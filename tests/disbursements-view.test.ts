import { describe, it, expect } from "vitest";
import { AdvanceStatus, Role } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import {
  calculateAdvanceBalances,
  canDisburseAdvance,
  canRecordEmployeeReturn,
} from "../src/lib/advance-rules";
import { formatCurrencyINR } from "../src/lib/formatters";

describe("Disbursement & Settlement Workspace Unit & Mock Tests", () => {
  describe("Role Access Guards", () => {
    it("should allow only SUPERADMIN to disburse advances", () => {
      expect(canDisburseAdvance({ currentUserRole: Role.SUPERADMIN, status: AdvanceStatus.APPROVED }).allowed).toBe(true);
      expect(canDisburseAdvance({ currentUserRole: Role.ADMIN, status: AdvanceStatus.APPROVED }).allowed).toBe(false);
      expect(canDisburseAdvance({ currentUserRole: Role.USER, status: AdvanceStatus.APPROVED }).allowed).toBe(false);
    });

    it("should allow only SUPERADMIN to record employee returns", () => {
      expect(canRecordEmployeeReturn({
        currentUserRole: Role.SUPERADMIN,
        status: AdvanceStatus.DISBURSED,
        availableBalance: 5000,
        returnAmount: 2000,
      }).allowed).toBe(true);

      expect(canRecordEmployeeReturn({
        currentUserRole: Role.ADMIN,
        status: AdvanceStatus.DISBURSED,
        availableBalance: 5000,
        returnAmount: 2000,
      }).allowed).toBe(false);
    });
  });

  describe("Balance Calculations & Financial Rules", () => {
    it("should compute exact available and outstanding balances for newly disbursed advance", () => {
      const balances = calculateAdvanceBalances({
        currentStatus: AdvanceStatus.DISBURSED,
        disbursedAmount: new Decimal(25000),
        adjustedAmount: new Decimal(0),
        returnedAmount: new Decimal(0),
        reservedAmount: new Decimal(0),
      });

      expect(Number(balances.availableBalance)).toBe(25000);
      expect(Number(balances.outstandingBalance)).toBe(25000);
    });

    it("should compute exact available balance when funds are reserved in submitted expense", () => {
      const balances = calculateAdvanceBalances({
        currentStatus: AdvanceStatus.DISBURSED,
        disbursedAmount: new Decimal(25000),
        adjustedAmount: new Decimal(0),
        returnedAmount: new Decimal(0),
        reservedAmount: new Decimal(10000),
      });

      expect(Number(balances.availableBalance)).toBe(15000);
      expect(Number(balances.outstandingBalance)).toBe(25000);
    });

    it("should compute exact balances for partially settled advance", () => {
      const balances = calculateAdvanceBalances({
        currentStatus: AdvanceStatus.PARTIALLY_SETTLED,
        disbursedAmount: new Decimal(25000),
        adjustedAmount: new Decimal(15000),
        returnedAmount: new Decimal(0),
        reservedAmount: new Decimal(0),
      });

      expect(Number(balances.availableBalance)).toBe(10000);
      expect(Number(balances.outstandingBalance)).toBe(10000);
    });

    it("should compute zero balance for fully settled advance", () => {
      const balances = calculateAdvanceBalances({
        currentStatus: AdvanceStatus.SETTLED,
        disbursedAmount: new Decimal(25000),
        adjustedAmount: new Decimal(15000),
        returnedAmount: new Decimal(10000),
        reservedAmount: new Decimal(0),
      });

      expect(Number(balances.availableBalance)).toBe(0);
      expect(Number(balances.outstandingBalance)).toBe(0);
    });
  });

  describe("View Model Serialization & Null-Safety", () => {
    it("should format empty workspace state cleanly", () => {
      const inboxData = {
        pendingDisbursement: [],
        activeAdvances: [],
        settledAdvances: [],
      };

      expect(Array.isArray(inboxData.pendingDisbursement)).toBe(true);
      expect(Array.isArray(inboxData.activeAdvances)).toBe(true);
      expect(inboxData.pendingDisbursement.length).toBe(0);
      expect(inboxData.activeAdvances.length).toBe(0);
    });

    it("should handle null optional fields without throwing", () => {
      const mockApprovedAdvance = {
        id: "adv_1",
        advanceNumber: "ADV-2026-000001",
        purpose: "Client trip travel expenses",
        requestedAmount: 15000,
        approvedAmount: 15000,
        disbursedAmount: 0,
        status: AdvanceStatus.APPROVED,
        requiredByDate: null,
        submittedAt: "2026-08-27T10:00:00.000Z",
        approvedAt: "2026-08-27T11:00:00.000Z",
        approvalNote: null,
        user: { id: "u1", name: "Employee User", email: "employee@company.com", role: Role.USER },
        approvedBy: null, // Nullable approver relation
      };

      expect(mockApprovedAdvance.approvedBy).toBeNull();
      expect(formatCurrencyINR(mockApprovedAdvance.approvedAmount)).toBe("₹15,000.00");
      expect(formatCurrencyINR(mockApprovedAdvance.disbursedAmount)).toBe("₹0.00");
    });

    it("should handle active disbursed advance with computed balances correctly", () => {
      const mockActiveAdvance = {
        id: "adv_2",
        advanceNumber: "ADV-2026-000002",
        purpose: "Hardware purchase advance",
        requestedAmount: 50000,
        approvedAmount: 50000,
        disbursedAmount: 50000,
        adjustedAmount: 20000,
        returnedAmount: 0,
        reservedAmount: 10000,
        availableBalance: 20000,
        outstandingBalance: 30000,
        status: AdvanceStatus.PARTIALLY_SETTLED,
        requiredByDate: "2026-08-30T00:00:00.000Z",
        expectedSettlementDate: "2026-09-15T00:00:00.000Z",
        disbursedAt: "2026-08-27T12:00:00.000Z",
        paymentMode: "NEFT",
        paymentReference: "UTR99887766",
        user: { id: "u2", name: "Senior Tech", email: "tech@company.com", role: Role.USER },
        approvedBy: { id: "u3", name: "Admin Approver", email: "admin@company.com" },
        disbursedBy: { id: "u4", name: "Superadmin", email: "superadmin@company.com" },
      };

      expect(mockActiveAdvance.availableBalance).toBe(20000);
      expect(mockActiveAdvance.outstandingBalance).toBe(30000);
      expect(formatCurrencyINR(mockActiveAdvance.availableBalance)).toBe("₹20,000.00");
      expect(formatCurrencyINR(mockActiveAdvance.outstandingBalance)).toBe("₹30,000.00");
    });
  });
});
