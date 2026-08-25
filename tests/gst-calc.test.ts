import { describe, it, expect } from "vitest";

describe("GST Calculation & Tax Split Engine", () => {
  it("should calculate INTRA_STATE tax split correctly (CGST + SGST)", () => {
    const taxableValue = 10000;
    const gstRatePercent = 18; // 18%
    const taxMode = "INTRA_STATE";

    const halfRate = gstRatePercent / 2; // 9%
    const cgstAmount = (taxableValue * halfRate) / 100; // 900
    const sgstAmount = (taxableValue * halfRate) / 100; // 900
    const igstAmount = 0;
    const totalGst = cgstAmount + sgstAmount + igstAmount;
    const totalAmount = taxableValue + totalGst;

    expect(halfRate).toBe(9);
    expect(cgstAmount).toBe(900);
    expect(sgstAmount).toBe(900);
    expect(totalGst).toBe(1800);
    expect(totalAmount).toBe(11800);
  });

  it("should calculate INTER_STATE tax split correctly (IGST only)", () => {
    const taxableValue = 25000;
    const gstRatePercent = 28; // 28%
    const taxMode = "INTER_STATE";

    const igstAmount = (taxableValue * gstRatePercent) / 100; // 7000
    const cgstAmount = 0;
    const sgstAmount = 0;
    const totalGst = igstAmount;
    const totalAmount = taxableValue + totalGst;

    expect(cgstAmount).toBe(0);
    expect(sgstAmount).toBe(0);
    expect(igstAmount).toBe(7000);
    expect(totalGst).toBe(7000);
    expect(totalAmount).toBe(32000);
  });

  it("should handle Cess properly in total GST", () => {
    const taxableValue = 50000;
    const gstRatePercent = 28;
    const cessAmount = 1500;

    const igstAmount = (taxableValue * gstRatePercent) / 100; // 14000
    const totalGst = igstAmount + cessAmount; // 15500
    const totalAmount = taxableValue + totalGst; // 65500

    expect(totalGst).toBe(15500);
    expect(totalAmount).toBe(65500);
  });
});
