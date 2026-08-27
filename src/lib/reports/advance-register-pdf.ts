import { PDFDocument, StandardFonts, rgb, degrees, PDFPage } from "pdf-lib";
import { AdvanceRegisterRow, AdvanceRegisterSummaryTotals, AdvanceRegisterFilterParams, TIMEZONE } from "./advance-register-query";
import { formatInTimeZone } from "date-fns-tz";

const ORG_NAME = "RADICAL HEALTH TECH PVT LTD";
const ORG_SUBTITLE = "Action Area II , Ecospace | GSTIN: 19AAACR1234A1Z5";

function formatInr(val: number | null | undefined): string {
  if (val === null || val === undefined) return "0.00";
  return Number(val).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export async function generateAdvanceRegisterPdf(params: {
  rows: AdvanceRegisterRow[];
  summaryTotals: AdvanceRegisterSummaryTotals;
  filterParams: AdvanceRegisterFilterParams;
  generatedByUser: { name: string; email: string; role: string };
}): Promise<Uint8Array> {
  const { rows, summaryTotals, generatedByUser } = params;

  const pdfDoc = await PDFDocument.create();
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  // Landscape A4 Dimensions: 841.89 x 595.28 points
  const PAGE_WIDTH = 841.89;
  const PAGE_HEIGHT = 595.28;
  const MARGIN_LEFT = 30;
  const MARGIN_RIGHT = 30;
  const MARGIN_TOP = 32;
  const MARGIN_BOTTOM = 32;
  const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;

  let currentPage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let cursorY = PAGE_HEIGHT - MARGIN_TOP;

  const checkNewPage = (neededHeight: number) => {
    if (cursorY - neededHeight < MARGIN_BOTTOM + 20) {
      drawFooter(currentPage);
      currentPage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      cursorY = PAGE_HEIGHT - MARGIN_TOP;
      drawHeader(currentPage, true);
    }
  };

  const drawHeader = (page: PDFPage, isSubsequent: boolean = false) => {
    const timestamp = formatInTimeZone(new Date(), TIMEZONE, "dd-MMM-yyyy HH:mm zzz");

    if (isSubsequent) {
      // Compact Running Header
      page.drawRectangle({
        x: MARGIN_LEFT,
        y: cursorY - 18,
        width: CONTENT_WIDTH,
        height: 18,
        color: rgb(0.08, 0.2, 0.4),
      });

      page.drawText(`${ORG_NAME} — EMPLOYEE ADVANCE REGISTER`, {
        x: MARGIN_LEFT + 6,
        y: cursorY - 13,
        size: 8,
        font: fontBold,
        color: rgb(1, 1, 1),
      });

      page.drawText(`Generated: ${timestamp} | Records: ${rows.length}`, {
        x: PAGE_WIDTH - MARGIN_RIGHT - 180,
        y: cursorY - 13,
        size: 7.5,
        font: fontRegular,
        color: rgb(0.85, 0.9, 0.98),
      });

      cursorY -= 26;
      drawTableHeader(page);
      return;
    }

    // Full Primary Header on Page 1
    page.drawRectangle({
      x: MARGIN_LEFT,
      y: cursorY - 38,
      width: CONTENT_WIDTH,
      height: 38,
      color: rgb(0.08, 0.2, 0.4),
    });

    page.drawText(`${ORG_NAME} — EMPLOYEE ADVANCE REGISTER`, {
      x: MARGIN_LEFT + 10,
      y: cursorY - 18,
      size: 12,
      font: fontBold,
      color: rgb(1, 1, 1),
    });

    page.drawText(ORG_SUBTITLE, {
      x: MARGIN_LEFT + 10,
      y: cursorY - 30,
      size: 7.5,
      font: fontRegular,
      color: rgb(0.85, 0.9, 0.98),
    });

    page.drawText(`Generated: ${timestamp}`, {
      x: PAGE_WIDTH - MARGIN_RIGHT - 180,
      y: cursorY - 18,
      size: 7.5,
      font: fontRegular,
      color: rgb(0.85, 0.9, 0.98),
    });

    page.drawText(`By: ${generatedByUser.name} (${generatedByUser.role})`, {
      x: PAGE_WIDTH - MARGIN_RIGHT - 180,
      y: cursorY - 30,
      size: 7.5,
      font: fontRegular,
      color: rgb(0.85, 0.9, 0.98),
    });

    cursorY -= 46;

    // KPI Summary Bar
    const kpiBoxHeight = 32;
    page.drawRectangle({
      x: MARGIN_LEFT,
      y: cursorY - kpiBoxHeight,
      width: CONTENT_WIDTH,
      height: kpiBoxHeight,
      borderColor: rgb(0.8, 0.85, 0.9),
      borderWidth: 1,
      color: rgb(0.96, 0.98, 1),
    });

    const kpis = [
      { label: "Total Disbursed", val: `INR ${formatInr(summaryTotals.totalDisbursed)}` },
      { label: "Expense Adjusted", val: `INR ${formatInr(summaryTotals.totalAdjusted)}` },
      { label: "Employee Returned", val: `INR ${formatInr(summaryTotals.totalReturned)}` },
      { label: "Outstanding Balance", val: `INR ${formatInr(summaryTotals.totalOutstanding)}` },
      { label: "Available Balance", val: `INR ${formatInr(summaryTotals.totalAvailable)}` },
    ];

    const kpiColWidth = CONTENT_WIDTH / kpis.length;
    kpis.forEach((kpi, idx) => {
      const x = MARGIN_LEFT + idx * kpiColWidth + 8;
      page.drawText(kpi.label, { x, y: cursorY - 12, size: 7.5, font: fontRegular, color: rgb(0.3, 0.35, 0.45) });
      page.drawText(kpi.val, { x, y: cursorY - 24, size: 8.5, font: fontBold, color: rgb(0.08, 0.2, 0.4) });
    });

    cursorY -= kpiBoxHeight + 14;
    drawTableHeader(page);
  };

  const tableCols = [
    { label: "Advance #", width: 85, align: "left" },
    { label: "Employee", width: 110, align: "left" },
    { label: "Purpose", width: 145, align: "left" },
    { label: "Status", width: 75, align: "center" },
    { label: "Disbursed", width: 70, align: "right" },
    { label: "Adjusted", width: 70, align: "right" },
    { label: "Returned", width: 65, align: "right" },
    { label: "Outstanding", width: 75, align: "right" },
    { label: "Available", width: 75, align: "right" },
  ];

  const drawTableHeader = (page: PDFPage) => {
    page.drawRectangle({
      x: MARGIN_LEFT,
      y: cursorY - 18,
      width: CONTENT_WIDTH,
      height: 18,
      color: rgb(0.08, 0.2, 0.4),
    });

    let curX = MARGIN_LEFT;
    tableCols.forEach((col) => {
      page.drawText(col.label, {
        x: col.align === "right" ? curX + col.width - fontBold.widthOfTextAtSize(col.label, 7.5) - 4 : curX + 4,
        y: cursorY - 12,
        size: 7.5,
        font: fontBold,
        color: rgb(1, 1, 1),
      });
      curX += col.width;
    });

    cursorY -= 20;
  };

  const drawFooter = (page: PDFPage) => {
    page.drawLine({
      start: { x: MARGIN_LEFT, y: MARGIN_BOTTOM + 12 },
      end: { x: PAGE_WIDTH - MARGIN_RIGHT, y: MARGIN_BOTTOM + 12 },
      thickness: 0.5,
      color: rgb(0.8, 0.85, 0.9),
    });

    page.drawText(`${ORG_NAME} — Confidential Advance Financial Register`, {
      x: MARGIN_LEFT,
      y: MARGIN_BOTTOM + 2,
      size: 7,
      font: fontRegular,
      color: rgb(0.5, 0.55, 0.6),
    });
  };

  // Render initial Header on Page 1
  drawHeader(currentPage, false);

  // Render Rows
  rows.forEach((row, idx) => {
    const rowHeight = 18;
    checkNewPage(rowHeight);

    const isEven = idx % 2 === 1;
    currentPage.drawRectangle({
      x: MARGIN_LEFT,
      y: cursorY - rowHeight,
      width: CONTENT_WIDTH,
      height: rowHeight,
      color: isEven ? rgb(0.97, 0.98, 1) : rgb(1, 1, 1),
      borderColor: rgb(0.9, 0.92, 0.95),
      borderWidth: 0.5,
    });

    let curX = MARGIN_LEFT;
    const values = [
      row.advanceNumber,
      `${row.requesterName.substring(0, 16)} (${row.requesterRole})`,
      row.purpose.substring(0, 26),
      row.status,
      formatInr(row.disbursedAmount),
      formatInr(row.adjustedAmount),
      formatInr(row.returnedAmount),
      formatInr(row.outstandingBalance),
      formatInr(row.availableBalance),
    ];

    tableCols.forEach((col, cIdx) => {
      const text = values[cIdx];
      const isRight = col.align === "right";
      const isStatus = cIdx === 3;
      const textWidth = fontRegular.widthOfTextAtSize(text, 7.5);
      const textX = isRight ? curX + col.width - textWidth - 4 : curX + 4;

      currentPage.drawText(text, {
        x: textX,
        y: cursorY - 12,
        size: 7.5,
        font: isStatus || isRight ? fontBold : fontRegular,
        color: isStatus
          ? row.status === "SETTLED"
            ? rgb(0.1, 0.55, 0.2)
            : row.status === "DISBURSED"
            ? rgb(0.1, 0.35, 0.7)
            : rgb(0.7, 0.35, 0.05)
          : rgb(0.15, 0.2, 0.25),
      });

      curX += col.width;
    });

    cursorY -= rowHeight;
  });

  // Final footer
  drawFooter(currentPage);

  // Add Page Numbers
  const totalPages = pdfDoc.getPageCount();
  const pages = pdfDoc.getPages();
  for (let i = 0; i < totalPages; i++) {
    const page = pages[i];
    const pageNumStr = `Page ${i + 1} of ${totalPages}`;
    page.drawText(pageNumStr, {
      x: PAGE_WIDTH - MARGIN_RIGHT - fontRegular.widthOfTextAtSize(pageNumStr, 7),
      y: MARGIN_BOTTOM + 2,
      size: 7,
      font: fontRegular,
      color: rgb(0.5, 0.55, 0.6),
    });
  }

  return await pdfDoc.save();
}
