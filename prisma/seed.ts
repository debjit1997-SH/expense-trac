import { PrismaClient, Role, AccountStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting Expense App Database Seed...");

  // 1. Seed Initial Superadmin
  const superadminEmail = (process.env.SUPERADMIN_EMAIL || "superadmin@company.com").toLowerCase().trim();
  const superadminPassword = process.env.SUPERADMIN_PASSWORD || "SuperPassword123!";
  const superadminPhone = process.env.SUPERADMIN_PHONE || "+919876543210";
  const superadminName = process.env.SUPERADMIN_NAME || "System Superadmin";

  const salt = await bcrypt.genSalt(10);
  const superadminPasswordHash = await bcrypt.hash(superadminPassword, salt);

  const superadmin = await prisma.user.upsert({
    where: { email: superadminEmail },
    update: {
      role: Role.SUPERADMIN,
      status: AccountStatus.ACTIVE,
    },
    create: {
      name: superadminName,
      email: superadminEmail,
      phone: superadminPhone,
      passwordHash: superadminPasswordHash,
      role: Role.SUPERADMIN,
      status: AccountStatus.ACTIVE,
    },
  });

  console.log(`✅ Superadmin verified: ${superadmin.email}`);

  // Seed standard Admin and Employee for testing
  const demoAdminPasswordHash = await bcrypt.hash("AdminPassword123!", salt);
  await prisma.user.upsert({
    where: { email: "admin@company.com" },
    update: {},
    create: {
      name: "Operations Admin",
      email: "admin@company.com",
      phone: "+919876543211",
      passwordHash: demoAdminPasswordHash,
      role: Role.ADMIN,
      status: AccountStatus.ACTIVE,
    },
  });

  const demoUserPasswordHash = await bcrypt.hash("UserPassword123!", salt);
  await prisma.user.upsert({
    where: { email: "employee@company.com" },
    update: {},
    create: {
      name: "Standard Employee",
      email: "employee@company.com",
      phone: "+919876543212",
      passwordHash: demoUserPasswordHash,
      role: Role.USER,
      status: AccountStatus.ACTIVE,
    },
  });

  // 2. Seed GST Treatments
  const gstTreatments = [
    { code: "TAXABLE_UNDER_GST", name: "TAXABLE UNDER GST", isTaxable: true },
    { code: "NIL_RATED", name: "NIL RATED", isTaxable: false },
    { code: "EXEMPT", name: "EXEMPT", isTaxable: false },
    { code: "NON_GST_OUTSIDE_SCOPE", name: "NON-GST / OUTSIDE SCOPE", isTaxable: false },
    { code: "REVERSE_CHARGE", name: "REVERSE CHARGE", isTaxable: true },
    { code: "BILL_OF_SUPPLY_COMPOSITION", name: "BILL OF SUPPLY / COMPOSITION DEALER", isTaxable: false },
    { code: "GST_NOT_AVAILABLE_UNREGISTERED", name: "GST NOT AVAILABLE / UNREGISTERED VENDOR", isTaxable: false },
  ];

  for (const treatment of gstTreatments) {
    await prisma.gstTreatment.upsert({
      where: { code: treatment.code },
      update: { name: treatment.name, isTaxable: treatment.isTaxable },
      create: treatment,
    });
  }
  console.log(`✅ Seeded ${gstTreatments.length} GST Treatments`);

  // 3. Seed GST Rates
  const gstRates = [
    { ratePercent: 0.00, label: "0%" },
    { ratePercent: 5.00, label: "5%" },
    { ratePercent: 12.00, label: "12%" },
    { ratePercent: 18.00, label: "18%" },
    { ratePercent: 28.00, label: "28%" },
  ];

  for (const rate of gstRates) {
    await prisma.gstRate.upsert({
      where: { ratePercent: rate.ratePercent },
      update: { label: rate.label },
      create: {
        ratePercent: rate.ratePercent,
        label: rate.label,
        isActive: true,
      },
    });
  }
  console.log(`✅ Seeded ${gstRates.length} GST Rates`);

  // 4. Seed Expense Categories & Subcategories
  const categoriesData = [
    {
      code: "TRAVEL",
      name: "TRAVEL",
      subcategories: [
        { code: "AIRFARE", name: "AIRFARE" },
        { code: "TRAIN", name: "TRAIN" },
        { code: "BUS", name: "BUS" },
        { code: "TAXI_CAB", name: "TAXI / CAB" },
        { code: "AUTO_RICKSHAW", name: "AUTO / RICKSHAW" },
        { code: "LOCAL_TRANSPORT", name: "LOCAL TRANSPORT" },
        { code: "FUEL", name: "FUEL" },
        { code: "TOLL", name: "TOLL" },
        { code: "PARKING", name: "PARKING" },
        { code: "VEHICLE_RENTAL", name: "VEHICLE RENTAL" },
      ],
    },
    {
      code: "ACCOMMODATION",
      name: "ACCOMMODATION",
      subcategories: [
        { code: "HOTEL", name: "HOTEL" },
        { code: "GUEST_HOUSE", name: "GUEST HOUSE" },
        { code: "OTHER_LODGING", name: "OTHER LODGING" },
      ],
    },
    {
      code: "MEALS_AND_REFRESHMENTS",
      name: "MEALS AND REFRESHMENTS",
      subcategories: [
        { code: "BREAKFAST", name: "BREAKFAST" },
        { code: "LUNCH", name: "LUNCH" },
        { code: "DINNER", name: "DINNER" },
        { code: "CLIENT_MEAL", name: "CLIENT MEAL" },
        { code: "TEAM_MEAL", name: "TEAM MEAL" },
        { code: "TEA_COFFEE", name: "TEA / COFFEE" },
        { code: "REFRESHMENTS", name: "REFRESHMENTS" },
      ],
    },
    {
      code: "OFFICE_SUPPLIES",
      name: "OFFICE SUPPLIES",
      subcategories: [
        { code: "STATIONERY", name: "STATIONERY" },
        { code: "PRINTING", name: "PRINTING" },
        { code: "PHOTOCOPY", name: "PHOTOCOPY" },
        { code: "COURIER", name: "COURIER" },
        { code: "POSTAGE", name: "POSTAGE" },
        { code: "OFFICE_CONSUMABLES", name: "OFFICE CONSUMABLES" },
      ],
    },
    {
      code: "COMMUNICATION",
      name: "COMMUNICATION",
      subcategories: [
        { code: "MOBILE", name: "MOBILE" },
        { code: "TELEPHONE", name: "TELEPHONE" },
        { code: "INTERNET", name: "INTERNET" },
        { code: "DATA_RECHARGE", name: "DATA RECHARGE" },
      ],
    },
    {
      code: "SOFTWARE_AND_IT",
      name: "SOFTWARE AND IT",
      subcategories: [
        { code: "SOFTWARE_SUBSCRIPTION", name: "SOFTWARE SUBSCRIPTION" },
        { code: "CLOUD_HOSTING", name: "CLOUD / HOSTING" },
        { code: "DOMAIN", name: "DOMAIN" },
        { code: "COMPUTER_HARDWARE", name: "COMPUTER HARDWARE" },
        { code: "COMPUTER_ACCESSORIES", name: "COMPUTER ACCESSORIES" },
        { code: "IT_REPAIR", name: "IT REPAIR" },
        { code: "IT_MAINTENANCE", name: "IT MAINTENANCE" },
      ],
    },
    {
      code: "MARKETING_AND_SALES",
      name: "MARKETING AND SALES",
      subcategories: [
        { code: "ADVERTISING", name: "ADVERTISING" },
        { code: "PROMOTIONAL_MATERIAL", name: "PROMOTIONAL MATERIAL" },
        { code: "CLIENT_MEETING", name: "CLIENT MEETING" },
        { code: "EVENT", name: "EVENT" },
        { code: "BUSINESS_DEVELOPMENT", name: "BUSINESS DEVELOPMENT" },
      ],
    },
    {
      code: "PROFESSIONAL_SERVICES",
      name: "PROFESSIONAL SERVICES",
      subcategories: [
        { code: "CONSULTING", name: "CONSULTING" },
        { code: "LEGAL", name: "LEGAL" },
        { code: "ACCOUNTING", name: "ACCOUNTING" },
        { code: "AUDIT", name: "AUDIT" },
        { code: "OTHER_PROFESSIONAL_FEE", name: "OTHER PROFESSIONAL FEE" },
      ],
    },
    {
      code: "UTILITIES",
      name: "UTILITIES",
      subcategories: [
        { code: "ELECTRICITY", name: "ELECTRICITY" },
        { code: "WATER", name: "WATER" },
        { code: "GAS", name: "GAS" },
        { code: "OTHER_UTILITY", name: "OTHER UTILITY" },
      ],
    },
    {
      code: "RENT_AND_FACILITIES",
      name: "RENT AND FACILITIES",
      subcategories: [
        { code: "OFFICE_RENT", name: "OFFICE RENT" },
        { code: "COWORKING", name: "COWORKING" },
        { code: "CLEANING", name: "CLEANING" },
        { code: "SECURITY", name: "SECURITY" },
        { code: "FACILITY_REPAIR", name: "FACILITY REPAIR" },
        { code: "FACILITY_MAINTENANCE", name: "FACILITY MAINTENANCE" },
      ],
    },
    {
      code: "EMPLOYEE_EXPENSES",
      name: "EMPLOYEE EXPENSES",
      subcategories: [
        { code: "TRAINING", name: "TRAINING" },
        { code: "RECRUITMENT", name: "RECRUITMENT" },
        { code: "STAFF_WELFARE", name: "STAFF WELFARE" },
        { code: "MEDICAL", name: "MEDICAL" },
        { code: "UNIFORM", name: "UNIFORM" },
      ],
    },
    {
      code: "BANKING_AND_FINANCE",
      name: "BANKING AND FINANCE",
      subcategories: [
        { code: "BANK_CHARGE", name: "BANK CHARGE" },
        { code: "PAYMENT_GATEWAY_FEE", name: "PAYMENT GATEWAY FEE" },
        { code: "INTEREST", name: "INTEREST" },
        { code: "FOREIGN_EXCHANGE_CHARGE", name: "FOREIGN EXCHANGE CHARGE" },
      ],
    },
    {
      code: "INSURANCE",
      name: "INSURANCE",
      subcategories: [
        { code: "BUSINESS_INSURANCE", name: "BUSINESS INSURANCE" },
        { code: "VEHICLE_INSURANCE", name: "VEHICLE INSURANCE" },
        { code: "OTHER_INSURANCE", name: "OTHER INSURANCE" },
      ],
    },
    {
      code: "TAXES_AND_GOVERNMENT_FEES",
      name: "TAXES AND GOVERNMENT FEES",
      subcategories: [
        { code: "LICENSE_FEE", name: "LICENSE FEE" },
        { code: "REGISTRATION_FEE", name: "REGISTRATION FEE" },
        { code: "STAMP_DUTY", name: "STAMP DUTY" },
        { code: "STATUTORY_FEE", name: "STATUTORY FEE" },
        { code: "OTHER_GOVERNMENT_FEE", name: "OTHER GOVERNMENT FEE" },
      ],
    },
    {
      code: "PURCHASES_AND_EQUIPMENT",
      name: "PURCHASES AND EQUIPMENT",
      subcategories: [
        { code: "RAW_MATERIAL", name: "RAW MATERIAL" },
        { code: "INVENTORY_PURCHASE", name: "INVENTORY PURCHASE" },
        { code: "SMALL_EQUIPMENT", name: "SMALL EQUIPMENT" },
        { code: "TOOLS", name: "TOOLS" },
        { code: "REPAIR_PARTS", name: "REPAIR PARTS" },
      ],
    },
    {
      code: "MISCELLANEOUS",
      name: "MISCELLANEOUS",
      subcategories: [
        { code: "OTHER", name: "OTHER" },
      ],
    },
  ];

  for (const cat of categoriesData) {
    const category = await prisma.expenseCategory.upsert({
      where: { code: cat.code },
      update: { name: cat.name },
      create: {
        code: cat.code,
        name: cat.name,
        isActive: true,
      },
    });

    for (const sub of cat.subcategories) {
      await prisma.expenseSubcategory.upsert({
        where: {
          categoryId_code: {
            categoryId: category.id,
            code: sub.code,
          },
        },
        update: { name: sub.name },
        create: {
          categoryId: category.id,
          code: sub.code,
          name: sub.name,
          isActive: true,
        },
      });
    }
  }

  console.log(`✅ Seeded ${categoriesData.length} Category Groups and all subcategories`);
  console.log("✨ Seeding completed successfully!");
}

main()
  .catch((e) => {
    console.error("❌ Seeding error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
