import { formatInTimeZone } from "date-fns-tz";
import { format, parseISO } from "date-fns";
import { Decimal } from "@prisma/client/runtime/library";

export const TIMEZONE_KOLKATA = "Asia/Kolkata";

/**
 * Format any UTC Date or ISO String to Asia/Kolkata (IST) display
 * Example output: "24 Aug 2026, 02:30 PM IST"
 */
export function formatToKolkataDateTime(
  date: Date | string | null | undefined,
  pattern: string = "dd MMM yyyy, hh:mm a"
): string {
  if (!date) return "-";
  const dateObj = typeof date === "string" ? parseISO(date) : date;
  try {
    const formatted = formatInTimeZone(dateObj, TIMEZONE_KOLKATA, pattern);
    return `${formatted} IST`;
  } catch {
    return "-";
  }
}

/**
 * Format any UTC Date or ISO String to Asia/Kolkata date only
 * Example output: "24 Aug 2026"
 */
export function formatToKolkataDate(
  date: Date | string | null | undefined,
  pattern: string = "dd MMM yyyy"
): string {
  if (!date) return "-";
  const dateObj = typeof date === "string" ? parseISO(date) : date;
  try {
    return formatInTimeZone(dateObj, TIMEZONE_KOLKATA, pattern);
  } catch {
    return "-";
  }
}

/**
 * Format currency amount to Indian Rupees (INR) format (e.g. ₹1,25,000.00)
 */
export function formatCurrencyINR(
  amount: number | string | Decimal | null | undefined
): string {
  if (amount === null || amount === undefined || amount === "") return "₹0.00";
  const numericVal = typeof amount === "object" && "toNumber" in amount 
    ? (amount as Decimal).toNumber() 
    : Number(amount);
  
  if (isNaN(numericVal)) return "₹0.00";

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numericVal);
}

/**
 * Convert any Decimal, string, or number to fixed decimal string
 */
export function toDecimalString(
  value: number | string | Decimal | null | undefined,
  decimals: number = 2
): string {
  if (value === null || value === undefined || value === "") return "0.00";
  const num = typeof value === "object" && "toNumber" in value
    ? (value as Decimal).toNumber()
    : Number(value);
  if (isNaN(num)) return "0.00";
  return num.toFixed(decimals);
}
