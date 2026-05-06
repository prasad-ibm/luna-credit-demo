export function fmtCurrency(amount: number | string | null | undefined, currency = "USD") {
  const n = typeof amount === "string" ? parseFloat(amount) : amount ?? 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(n);
}

export function fmtDate(d: Date | string | null | undefined) {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export function fmtDays(days: number | null | undefined) {
  if (days == null) return "—";
  if (days === 0) return "today";
  if (days === 1) return "1 day";
  return `${days} days`;
}

export function riskColor(risk: string | null | undefined) {
  switch (risk) {
    case "LOW":    return "bg-green-100 text-green-800 border-green-200";
    case "MEDIUM": return "bg-yellow-100 text-yellow-800 border-yellow-200";
    case "HIGH":   return "bg-orange-100 text-orange-800 border-orange-200";
    case "WATCH":  return "bg-red-100 text-red-800 border-red-200";
    default:       return "bg-gray-100 text-gray-700 border-gray-200";
  }
}

export function agingColor(bucket: string | null | undefined) {
  switch (bucket) {
    case "CURRENT": return "bg-green-50 text-green-700";
    case "30":      return "bg-yellow-50 text-yellow-700";
    case "60":      return "bg-orange-50 text-orange-700";
    case "90+":     return "bg-red-50 text-red-700";
    default:        return "bg-gray-50 text-gray-700";
  }
}
