# Enterprise Expense Management & Reimbursement System (Phase 1)

A full-stack, production-ready corporate Expense Management, GST Invoice Processing, and Reimbursement application built with **Next.js App Router**, **TypeScript**, **Tailwind CSS**, **Prisma ORM**, **Auth.js / NextAuth**, **Supabase PostgreSQL / Storage**, **Zod**, and **bcryptjs**.

---

## 🚀 Key Features & Highlights

- **Role-Based Access Control (RBAC)**:
  - Three distinct roles: `USER`, `ADMIN`, `SUPERADMIN`.
  - Zero-trust server actions with ownership validation and permission guards.
  - Strict self-approval prevention (reviewers cannot approve their own submitted expense reports).
- **Authentication & Access Request Lifecycle**:
  - Request access registration (public users can only register with `PENDING` status; cannot select roles).
  - Secure password hashing with `bcryptjs`.
  - Administrator approval workflow (`ACTIVE`, `REJECTED`, `DISABLED` statuses).
  - Soft deactivation keeps financial history intact.
- **Hierarchical Expense Model**:
  - **ExpenseTag / Report** (Parent record with sequential format `EXP-YYYY-XXXXXX`).
  - **ExpenseItem** (Child items with full category, description, and amounts).
  - **ExpenseEvidence** (Private storage receipt documents).
  - High-precision monetary storage using **Prisma Decimal** (no floating-point rounding errors).
- **Receipt Upload & Provider-Neutral OCR Extraction**:
  - Upload JPG, PNG, WEBP, and PDF receipts up to 10MB to private Supabase Storage buckets.
  - Automatic OCR analysis with Gemini / multimodal vision extraction for suggestions (vendor, invoice number, date, amount, GSTIN, tax split).
  - Extracted fields are editable with clear visual indicators.
  - Controlled signed URLs ensure secure access for authorized owners/reviewers only.
- **Comprehensive GST & Tax Master Management**:
  - Seeded with all 7 standard GST Treatments (*TAXABLE UNDER GST, NIL RATED, EXEMPT, NON-GST / OUTSIDE SCOPE, REVERSE CHARGE, BILL OF SUPPLY / COMPOSITION, UNREGISTERED VENDOR*).
  - 5 Standard GST Rates (*0%, 5%, 12%, 18%, 28%*).
  - Dynamic Intra-State (CGST + SGST) vs Inter-State (IGST) calculation engine.
  - ITC Eligibility tracking (*PENDING REVIEW*, *ELIGIBLE*, *INELIGIBLE*, *NOT APPLICABLE*).
- **16 Expense Category Groups & Subcategories**:
  - Comprehensive seed covering TRAVEL, ACCOMMODATION, MEALS & REFRESHMENTS, OFFICE SUPPLIES, SOFTWARE & IT, MARKETING & SALES, PROFESSIONAL SERVICES, UTILITIES, RENT, EMPLOYEE EXPENSES, BANKING, INSURANCE, TAXES & FEES, PURCHASES & EQUIPMENT, and MISCELLANEOUS (OTHER).
  - Category labels formatted in uppercase.
- **Workflow & Concurrency**:
  - Status progression: `DRAFT` $\rightarrow$ `SUBMITTED` $\rightarrow$ `APPROVED` $\rightarrow$ `REIMBURSED`.
  - Dedicated **Rollback Submitted Expense** page for owners.
  - Full audit logging for all mutations and status changes.
- **Timezone Standardization**:
  - Server timestamps stored in UTC and rendered across all UI components in `Asia/Kolkata` (IST) format.

---

## 👥 Default Evaluation Test Accounts

| Role | Email Address | Password | Capabilities |
| :--- | :--- | :--- | :--- |
| **SUPERADMIN** | `superadmin@company.com` | `SuperPassword123!` | Full system access, approve reports (non-self), disburse reimbursements, manage all users & masters |
| **ADMIN** | `admin@company.com` | `AdminPassword123!` | Manage access requests & users (except Superadmin), review submitted reports, manage masters |
| **USER** | `employee@company.com` | `UserPassword123!` | Create expense tags, upload receipts, submit reports, rollback submitted reports |

---

## 🛠️ Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript 5
- **Database ORM**: Prisma ORM with PostgreSQL
- **Authentication**: Auth.js / NextAuth (Credentials Provider with JWT sessions)
- **Security**: bcryptjs password hashing, server-side Zod validation
- **Storage**: Supabase Private Storage / Signed URLs with local secure buffer fallback
- **Styling**: Tailwind CSS & Lucide React icons
- **Testing**: Vitest automated test suite

---

## 📦 Local Development Setup

### 1. Prerequisites
- Node.js (v18+ or v20+)
- PostgreSQL database instance (or Supabase project)

### 2. Environment Configuration
Copy `.env.example` to `.env` and fill in your connection strings:
```bash
cp .env.example .env
```

Example configuration in `.env`:
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/expense_app_db?schema=public"
DIRECT_URL="postgresql://postgres:postgres@localhost:5432/expense_app_db?schema=public"
NEXTAUTH_SECRET="your-random-32-character-secret"
AUTH_SECRET="your-random-32-character-secret"
NEXTAUTH_URL="http://localhost:3000"
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# Initial Superadmin details
SUPERADMIN_EMAIL="superadmin@company.com"
SUPERADMIN_PASSWORD="SuperPassword123!"

# Supabase Storage (Optional - falls back to local storage if credentials are dummy)
SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="your-supabase-service-role-key"
SUPABASE_STORAGE_BUCKET="receipts"

# OCR API Key (Optional)
GEMINI_API_KEY="your-gemini-api-key"
```

### 3. Install Dependencies & Initialize Database
```bash
npm install
npx prisma generate
npx prisma db push
npm run prisma:seed
```

### 4. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🧪 Automated Testing

Execute the comprehensive test suite verifying RBAC, workflow transitions, self-approval prevention, rollback safety, and GST calculations:
```bash
npm run test
```

### Test Coverage:
- `tests/rbac.test.ts`: Role validation, account status checks (PENDING/DISABLED), bcrypt hashing.
- `tests/workflow.test.ts`: DRAFT $\rightarrow$ SUBMITTED $\rightarrow$ APPROVED $\rightarrow$ REIMBURSED lifecycle, dynamic amount calculation, self-approval denial.
- `tests/rollback.test.ts`: Owner-only rollback, transactional status validation, approved report rollback prevention.
- `tests/gst-calc.test.ts`: Intra-state (CGST+SGST) vs Inter-state (IGST) tax split calculations and Cess support.

---

## ☁️ Supabase Private Storage Setup

To use live Supabase Storage in production:
1. Log in to [Supabase Console](https://supabase.com/dashboard).
2. Navigate to **Storage** $\rightarrow$ **New Bucket**.
3. Name the bucket `receipts` and mark it as **Private** (Public: `OFF`).
4. Copy your project URL and `service_role` secret key from **Project Settings $\rightarrow$ API**.
5. Set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `SUPABASE_STORAGE_BUCKET=receipts` in your environment variables.

---

## 🚀 Vercel Deployment Instructions

1. Push this repository to GitHub / GitLab.
2. In the [Vercel Dashboard](https://vercel.com), click **Add New Project** and import the repository.
3. Configure the environment variables:
   - `DATABASE_URL` (Supabase Connection Pooler / Transaction URL)
   - `DIRECT_URL` (Supabase Direct Connection URL)
   - `NEXTAUTH_SECRET` & `AUTH_SECRET`
   - `NEXTAUTH_URL` (e.g. `https://your-domain.vercel.app`)
   - `NEXT_PUBLIC_APP_URL` (e.g. `https://your-domain.vercel.app`)
   - `SUPABASE_URL` & `SUPABASE_SERVICE_ROLE_KEY`
   - `GEMINI_API_KEY` (if OCR suggestions are enabled)
4. Deploy the project. The build script automatically executes `prisma generate && next build`.

---

## 📋 Role & Permissions Matrix

| Capability | USER | ADMIN | SUPERADMIN |
| :--- | :---: | :---: | :---: |
| Request Access (Public) | ✅ (Pending) | — | — |
| Create Expense Tag & Items | ✅ | ✅ | ✅ |
| View Own Reports | ✅ | ✅ | ✅ |
| View Others' Submitted Reports | ❌ | ✅ | ✅ |
| View Others' Draft Reports | ❌ | ❌ | ❌ |
| Submit Own Draft Report | ✅ | ✅ | ✅ |
| Rollback Own Submitted Report | ✅ | ✅ | ✅ |
| Approve Others' Submitted Report | ❌ | ✅ | ✅ |
| Approve Own Report (Self-approval) | ❌ | ❌ | ❌ |
| Mark Approved Report as Reimbursed | ❌ | ❌ | ✅ |
| View User Management Menu | ❌ | ✅ | ✅ |
| Approve Access Request (User/Admin) | ❌ | ✅ | ✅ |
| Approve Access Request (Superadmin) | ❌ | ❌ | ✅ |
| Deactivate User Account | ❌ | ✅ (non-Superadmin) | ✅ (non-last Superadmin) |
| Manage Categories & GST Masters | ❌ | ✅ | ✅ |
| Audit Trail Visibility | Own Reports | All Approved/Submitted | Full System |
