-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN', 'SUPERADMIN');

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('PENDING', 'ACTIVE', 'REJECTED', 'DISABLED');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REIMBURSED');

-- CreateEnum
CREATE TYPE "WorkflowStage" AS ENUM ('ADMIN_APPROVAL', 'REIMBURSEMENT');

-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('PENDING', 'COMPLETED', 'CANCELLED', 'REASSIGNED');

-- CreateEnum
CREATE TYPE "RecipientType" AS ENUM ('PRIMARY', 'CC');

-- CreateEnum
CREATE TYPE "DocumentGenStatus" AS ENUM ('PENDING', 'GENERATED', 'FAILED');

-- CreateEnum
CREATE TYPE "TaxMode" AS ENUM ('INTRA_STATE', 'INTER_STATE');

-- CreateEnum
CREATE TYPE "ItcEligibility" AS ENUM ('PENDING_REVIEW', 'ELIGIBLE', 'INELIGIBLE', 'NOT_APPLICABLE');

-- CreateEnum
CREATE TYPE "VendorGstStatus" AS ENUM ('REGISTERED_REGULAR', 'REGISTERED_COMPOSITION', 'UNREGISTERED', 'OVERSEAS');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "status" "AccountStatus" NOT NULL DEFAULT 'PENDING',
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportViewPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "columnConfig" JSONB NOT NULL,
    "filterConfig" JSONB,
    "sortConfig" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReportViewPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccessApprovalHistory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" "AccountStatus" NOT NULL,
    "assignedRole" "Role",
    "reason" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccessApprovalHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpenseCategory" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExpenseCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpenseSubcategory" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExpenseSubcategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GstTreatment" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isTaxable" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GstTreatment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GstRate" (
    "id" TEXT NOT NULL,
    "ratePercent" DECIMAL(5,2) NOT NULL,
    "label" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GstRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpenseReport" (
    "id" TEXT NOT NULL,
    "reportNumber" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "ReportStatus" NOT NULL DEFAULT 'DRAFT',
    "totalAmount" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "userId" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "approvalNote" TEXT,
    "reimbursedAt" TIMESTAMP(3),
    "reimbursedById" TEXT,
    "reimbursementRef" TEXT,
    "reimbursementNote" TEXT,
    "reimbursementDate" TIMESTAMP(3),
    "paymentMethod" TEXT,
    "transactionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExpenseReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalAssignment" (
    "id" TEXT NOT NULL,
    "expenseReportId" TEXT NOT NULL,
    "stage" "WorkflowStage" NOT NULL,
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

    CONSTRAINT "ApprovalAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowRecipient" (
    "id" TEXT NOT NULL,
    "expenseReportId" TEXT NOT NULL,
    "workflowStage" "WorkflowStage" NOT NULL,
    "recipientUserId" TEXT NOT NULL,
    "recipientType" "RecipientType" NOT NULL DEFAULT 'CC',
    "selectedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkflowRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpenseReportDocument" (
    "id" TEXT NOT NULL,
    "expenseReportId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "workflowStatus" "ReportStatus" NOT NULL,
    "storagePath" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL DEFAULT 'application/pdf',
    "fileSize" INTEGER NOT NULL,
    "checksum" TEXT,
    "generationStatus" "DocumentGenStatus" NOT NULL DEFAULT 'PENDING',
    "generationError" TEXT,
    "generatedByUserId" TEXT,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,
    "supersededAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExpenseReportDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpenseItem" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "expenseDate" TIMESTAMP(3) NOT NULL,
    "vendorName" TEXT NOT NULL,
    "invoiceNumber" TEXT,
    "invoiceDate" TIMESTAMP(3),
    "description" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "subcategoryId" TEXT NOT NULL,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "gstTreatmentId" TEXT,
    "gstRateId" TEXT,
    "documentType" TEXT,
    "vendorGstStatus" "VendorGstStatus",
    "vendorGstin" TEXT,
    "companyGstin" TEXT,
    "placeOfSupply" TEXT,
    "hsnSacCode" TEXT,
    "taxableValue" DECIMAL(12,2),
    "taxMode" "TaxMode",
    "cgstRate" DECIMAL(5,2),
    "cgstAmount" DECIMAL(12,2),
    "sgstRate" DECIMAL(5,2),
    "sgstAmount" DECIMAL(12,2),
    "igstRate" DECIMAL(5,2),
    "igstAmount" DECIMAL(12,2),
    "cessAmount" DECIMAL(12,2),
    "totalGstAmount" DECIMAL(12,2),
    "reverseCharge" BOOLEAN NOT NULL DEFAULT false,
    "itcEligibility" "ItcEligibility" NOT NULL DEFAULT 'PENDING_REVIEW',
    "gstRemarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExpenseItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpenseEvidence" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "itemId" TEXT,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "storagePath" TEXT NOT NULL,
    "uploaderId" TEXT NOT NULL,
    "ocrConfidence" DECIMAL(5,2),
    "ocrRawResponse" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExpenseEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "reportId" TEXT,
    "previousVal" TEXT,
    "newVal" TEXT,
    "reason" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_status_idx" ON "User"("status");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "ReportViewPreference_userId_idx" ON "ReportViewPreference"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ReportViewPreference_userId_name_key" ON "ReportViewPreference"("userId", "name");

-- CreateIndex
CREATE INDEX "AccessApprovalHistory_userId_idx" ON "AccessApprovalHistory"("userId");

-- CreateIndex
CREATE INDEX "AccessApprovalHistory_actorId_idx" ON "AccessApprovalHistory"("actorId");

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseCategory_code_key" ON "ExpenseCategory"("code");

-- CreateIndex
CREATE INDEX "ExpenseCategory_isActive_idx" ON "ExpenseCategory"("isActive");

-- CreateIndex
CREATE INDEX "ExpenseSubcategory_categoryId_isActive_idx" ON "ExpenseSubcategory"("categoryId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseSubcategory_categoryId_code_key" ON "ExpenseSubcategory"("categoryId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "GstTreatment_code_key" ON "GstTreatment"("code");

-- CreateIndex
CREATE UNIQUE INDEX "GstRate_ratePercent_key" ON "GstRate"("ratePercent");

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseReport_reportNumber_key" ON "ExpenseReport"("reportNumber");

-- CreateIndex
CREATE INDEX "ExpenseReport_userId_status_idx" ON "ExpenseReport"("userId", "status");

-- CreateIndex
CREATE INDEX "ExpenseReport_status_submittedAt_idx" ON "ExpenseReport"("status", "submittedAt");

-- CreateIndex
CREATE INDEX "ExpenseReport_status_idx" ON "ExpenseReport"("status");

-- CreateIndex
CREATE INDEX "ExpenseReport_reportNumber_idx" ON "ExpenseReport"("reportNumber");

-- CreateIndex
CREATE INDEX "ExpenseReport_createdAt_idx" ON "ExpenseReport"("createdAt");

-- CreateIndex
CREATE INDEX "ExpenseReport_submittedAt_idx" ON "ExpenseReport"("submittedAt");

-- CreateIndex
CREATE INDEX "ApprovalAssignment_assigneeUserId_status_idx" ON "ApprovalAssignment"("assigneeUserId", "status");

-- CreateIndex
CREATE INDEX "ApprovalAssignment_expenseReportId_stage_status_idx" ON "ApprovalAssignment"("expenseReportId", "stage", "status");

-- CreateIndex
CREATE INDEX "ApprovalAssignment_status_idx" ON "ApprovalAssignment"("status");

-- CreateIndex
CREATE INDEX "ApprovalAssignment_assignedAt_idx" ON "ApprovalAssignment"("assignedAt");

-- CreateIndex
CREATE INDEX "WorkflowRecipient_expenseReportId_workflowStage_idx" ON "WorkflowRecipient"("expenseReportId", "workflowStage");

-- CreateIndex
CREATE INDEX "WorkflowRecipient_recipientUserId_idx" ON "WorkflowRecipient"("recipientUserId");

-- CreateIndex
CREATE INDEX "ExpenseReportDocument_expenseReportId_workflowStatus_idx" ON "ExpenseReportDocument"("expenseReportId", "workflowStatus");

-- CreateIndex
CREATE INDEX "ExpenseReportDocument_expenseReportId_isCurrent_idx" ON "ExpenseReportDocument"("expenseReportId", "isCurrent");

-- CreateIndex
CREATE INDEX "ExpenseReportDocument_generationStatus_idx" ON "ExpenseReportDocument"("generationStatus");

-- CreateIndex
CREATE INDEX "ExpenseReportDocument_generatedAt_idx" ON "ExpenseReportDocument"("generatedAt");

-- CreateIndex
CREATE INDEX "ExpenseItem_reportId_idx" ON "ExpenseItem"("reportId");

-- CreateIndex
CREATE INDEX "ExpenseItem_categoryId_idx" ON "ExpenseItem"("categoryId");

-- CreateIndex
CREATE INDEX "ExpenseItem_subcategoryId_idx" ON "ExpenseItem"("subcategoryId");

-- CreateIndex
CREATE INDEX "ExpenseItem_expenseDate_idx" ON "ExpenseItem"("expenseDate");

-- CreateIndex
CREATE INDEX "ExpenseItem_vendorName_idx" ON "ExpenseItem"("vendorName");

-- CreateIndex
CREATE INDEX "ExpenseEvidence_reportId_idx" ON "ExpenseEvidence"("reportId");

-- CreateIndex
CREATE INDEX "ExpenseEvidence_itemId_idx" ON "ExpenseEvidence"("itemId");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_idx" ON "AuditLog"("actorId");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_reportId_idx" ON "AuditLog"("reportId");

-- CreateIndex
CREATE INDEX "AuditLog_timestamp_idx" ON "AuditLog"("timestamp");

-- AddForeignKey
ALTER TABLE "ReportViewPreference" ADD CONSTRAINT "ReportViewPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessApprovalHistory" ADD CONSTRAINT "AccessApprovalHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessApprovalHistory" ADD CONSTRAINT "AccessApprovalHistory_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseSubcategory" ADD CONSTRAINT "ExpenseSubcategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ExpenseCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseReport" ADD CONSTRAINT "ExpenseReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseReport" ADD CONSTRAINT "ExpenseReport_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseReport" ADD CONSTRAINT "ExpenseReport_reimbursedById_fkey" FOREIGN KEY ("reimbursedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalAssignment" ADD CONSTRAINT "ApprovalAssignment_expenseReportId_fkey" FOREIGN KEY ("expenseReportId") REFERENCES "ExpenseReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalAssignment" ADD CONSTRAINT "ApprovalAssignment_assigneeUserId_fkey" FOREIGN KEY ("assigneeUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalAssignment" ADD CONSTRAINT "ApprovalAssignment_assignedByUserId_fkey" FOREIGN KEY ("assignedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowRecipient" ADD CONSTRAINT "WorkflowRecipient_expenseReportId_fkey" FOREIGN KEY ("expenseReportId") REFERENCES "ExpenseReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowRecipient" ADD CONSTRAINT "WorkflowRecipient_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowRecipient" ADD CONSTRAINT "WorkflowRecipient_selectedByUserId_fkey" FOREIGN KEY ("selectedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseReportDocument" ADD CONSTRAINT "ExpenseReportDocument_expenseReportId_fkey" FOREIGN KEY ("expenseReportId") REFERENCES "ExpenseReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseReportDocument" ADD CONSTRAINT "ExpenseReportDocument_generatedByUserId_fkey" FOREIGN KEY ("generatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseItem" ADD CONSTRAINT "ExpenseItem_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "ExpenseReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseItem" ADD CONSTRAINT "ExpenseItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ExpenseCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseItem" ADD CONSTRAINT "ExpenseItem_subcategoryId_fkey" FOREIGN KEY ("subcategoryId") REFERENCES "ExpenseSubcategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseItem" ADD CONSTRAINT "ExpenseItem_gstTreatmentId_fkey" FOREIGN KEY ("gstTreatmentId") REFERENCES "GstTreatment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseItem" ADD CONSTRAINT "ExpenseItem_gstRateId_fkey" FOREIGN KEY ("gstRateId") REFERENCES "GstRate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseEvidence" ADD CONSTRAINT "ExpenseEvidence_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "ExpenseReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseEvidence" ADD CONSTRAINT "ExpenseEvidence_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "ExpenseItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseEvidence" ADD CONSTRAINT "ExpenseEvidence_uploaderId_fkey" FOREIGN KEY ("uploaderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "ExpenseReport"("id") ON DELETE SET NULL ON UPDATE CASCADE;
