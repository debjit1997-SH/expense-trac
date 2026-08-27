-- CreateEnum
CREATE TYPE "AdvanceStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'DISBURSED', 'PARTIALLY_SETTLED', 'SETTLED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AdvanceAllocationStatus" AS ENUM ('RESERVED', 'SETTLED', 'RELEASED');

-- CreateEnum
CREATE TYPE "AdvanceTransactionType" AS ENUM ('DISBURSEMENT', 'EXPENSE_ADJUSTMENT', 'EMPLOYEE_RETURN', 'REVERSAL');

-- AlterTable
ALTER TABLE "ExpenseReport" ADD COLUMN "advanceAdjustedAmount" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
ADD COLUMN "netPayableAmount" DECIMAL(12,2) NOT NULL DEFAULT 0.00;

-- CreateTable
CREATE TABLE "AdvanceRequest" (
    "id" TEXT NOT NULL,
    "advanceNumber" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "requestedAmount" DECIMAL(12,2) NOT NULL,
    "approvedAmount" DECIMAL(12,2),
    "disbursedAmount" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "adjustedAmount" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "returnedAmount" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "reservedAmount" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "status" "AdvanceStatus" NOT NULL DEFAULT 'DRAFT',
    "requiredByDate" TIMESTAMP(3),
    "expectedSettlementDate" TIMESTAMP(3),
    "remarks" TEXT,
    "rejectionReason" TEXT,
    "cancellationReason" TEXT,
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "approvalNote" TEXT,
    "disbursedAt" TIMESTAMP(3),
    "disbursedById" TEXT,
    "paymentMode" TEXT,
    "paymentReference" TEXT,
    "disbursementRemark" TEXT,
    "finalSettledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdvanceRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvanceAllocation" (
    "id" TEXT NOT NULL,
    "advanceRequestId" TEXT NOT NULL,
    "expenseReportId" TEXT NOT NULL,
    "allocatedAmount" DECIMAL(12,2) NOT NULL,
    "status" "AdvanceAllocationStatus" NOT NULL DEFAULT 'RESERVED',
    "reservedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "settledAt" TIMESTAMP(3),
    "releasedAt" TIMESTAMP(3),
    "releaseReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdvanceAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvanceLedgerEntry" (
    "id" TEXT NOT NULL,
    "advanceRequestId" TEXT NOT NULL,
    "type" "AdvanceTransactionType" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "runningBalance" DECIMAL(12,2) NOT NULL,
    "expenseReportId" TEXT,
    "performedById" TEXT NOT NULL,
    "paymentMode" TEXT,
    "paymentReference" TEXT,
    "remark" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdvanceLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvanceApprovalAssignment" (
    "id" TEXT NOT NULL,
    "advanceRequestId" TEXT NOT NULL,
    "assigneeUserId" TEXT NOT NULL,
    "assignedByUserId" TEXT NOT NULL,
    "status" "AssignmentStatus" NOT NULL DEFAULT 'PENDING',
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "reassignedFromId" TEXT,
    "reassignmentReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdvanceApprovalAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvanceWorkflowRecipient" (
    "id" TEXT NOT NULL,
    "advanceRequestId" TEXT NOT NULL,
    "recipientUserId" TEXT NOT NULL,
    "recipientType" "RecipientType" NOT NULL DEFAULT 'CC',
    "selectedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdvanceWorkflowRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvanceEvidence" (
    "id" TEXT NOT NULL,
    "advanceRequestId" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "storagePath" TEXT NOT NULL,
    "uploaderId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdvanceEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdvanceRequest_advanceNumber_key" ON "AdvanceRequest"("advanceNumber");

-- CreateIndex
CREATE INDEX "AdvanceRequest_userId_status_idx" ON "AdvanceRequest"("userId", "status");

-- CreateIndex
CREATE INDEX "AdvanceRequest_status_submittedAt_idx" ON "AdvanceRequest"("status", "submittedAt");

-- CreateIndex
CREATE INDEX "AdvanceRequest_status_idx" ON "AdvanceRequest"("status");

-- CreateIndex
CREATE INDEX "AdvanceRequest_advanceNumber_idx" ON "AdvanceRequest"("advanceNumber");

-- CreateIndex
CREATE INDEX "AdvanceRequest_createdAt_idx" ON "AdvanceRequest"("createdAt");

-- CreateIndex
CREATE INDEX "AdvanceRequest_expectedSettlementDate_idx" ON "AdvanceRequest"("expectedSettlementDate");

-- CreateIndex
CREATE UNIQUE INDEX "AdvanceAllocation_expenseReportId_key" ON "AdvanceAllocation"("expenseReportId");

-- CreateIndex
CREATE INDEX "AdvanceAllocation_advanceRequestId_status_idx" ON "AdvanceAllocation"("advanceRequestId", "status");

-- CreateIndex
CREATE INDEX "AdvanceAllocation_expenseReportId_idx" ON "AdvanceAllocation"("expenseReportId");

-- CreateIndex
CREATE INDEX "AdvanceLedgerEntry_advanceRequestId_timestamp_idx" ON "AdvanceLedgerEntry"("advanceRequestId", "timestamp");

-- CreateIndex
CREATE INDEX "AdvanceLedgerEntry_type_idx" ON "AdvanceLedgerEntry"("type");

-- CreateIndex
CREATE INDEX "AdvanceLedgerEntry_expenseReportId_idx" ON "AdvanceLedgerEntry"("expenseReportId");

-- CreateIndex
CREATE INDEX "AdvanceApprovalAssignment_assigneeUserId_status_idx" ON "AdvanceApprovalAssignment"("assigneeUserId", "status");

-- CreateIndex
CREATE INDEX "AdvanceApprovalAssignment_advanceRequestId_status_idx" ON "AdvanceApprovalAssignment"("advanceRequestId", "status");

-- CreateIndex
CREATE INDEX "AdvanceApprovalAssignment_assignedAt_idx" ON "AdvanceApprovalAssignment"("assignedAt");

-- CreateIndex
CREATE INDEX "AdvanceWorkflowRecipient_advanceRequestId_idx" ON "AdvanceWorkflowRecipient"("advanceRequestId");

-- CreateIndex
CREATE INDEX "AdvanceWorkflowRecipient_recipientUserId_idx" ON "AdvanceWorkflowRecipient"("recipientUserId");

-- CreateIndex
CREATE INDEX "AdvanceEvidence_advanceRequestId_idx" ON "AdvanceEvidence"("advanceRequestId");

-- AddForeignKey
ALTER TABLE "AdvanceRequest" ADD CONSTRAINT "AdvanceRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvanceRequest" ADD CONSTRAINT "AdvanceRequest_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvanceRequest" ADD CONSTRAINT "AdvanceRequest_disbursedById_fkey" FOREIGN KEY ("disbursedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvanceAllocation" ADD CONSTRAINT "AdvanceAllocation_advanceRequestId_fkey" FOREIGN KEY ("advanceRequestId") REFERENCES "AdvanceRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvanceAllocation" ADD CONSTRAINT "AdvanceAllocation_expenseReportId_fkey" FOREIGN KEY ("expenseReportId") REFERENCES "ExpenseReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvanceLedgerEntry" ADD CONSTRAINT "AdvanceLedgerEntry_advanceRequestId_fkey" FOREIGN KEY ("advanceRequestId") REFERENCES "AdvanceRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvanceLedgerEntry" ADD CONSTRAINT "AdvanceLedgerEntry_expenseReportId_fkey" FOREIGN KEY ("expenseReportId") REFERENCES "ExpenseReport"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvanceLedgerEntry" ADD CONSTRAINT "AdvanceLedgerEntry_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvanceApprovalAssignment" ADD CONSTRAINT "AdvanceApprovalAssignment_advanceRequestId_fkey" FOREIGN KEY ("advanceRequestId") REFERENCES "AdvanceRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvanceApprovalAssignment" ADD CONSTRAINT "AdvanceApprovalAssignment_assigneeUserId_fkey" FOREIGN KEY ("assigneeUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvanceApprovalAssignment" ADD CONSTRAINT "AdvanceApprovalAssignment_assignedByUserId_fkey" FOREIGN KEY ("assignedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvanceWorkflowRecipient" ADD CONSTRAINT "AdvanceWorkflowRecipient_advanceRequestId_fkey" FOREIGN KEY ("advanceRequestId") REFERENCES "AdvanceRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvanceWorkflowRecipient" ADD CONSTRAINT "AdvanceWorkflowRecipient_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvanceWorkflowRecipient" ADD CONSTRAINT "AdvanceWorkflowRecipient_selectedByUserId_fkey" FOREIGN KEY ("selectedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvanceEvidence" ADD CONSTRAINT "AdvanceEvidence_advanceRequestId_fkey" FOREIGN KEY ("advanceRequestId") REFERENCES "AdvanceRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvanceEvidence" ADD CONSTRAINT "AdvanceEvidence_uploaderId_fkey" FOREIGN KEY ("uploaderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
