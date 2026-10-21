const AR_DIGITS = /[٠-٩۰-۹]/g;
/** Convert Arabic-Indic / Persian digits to ASCII (length-preserving). */
export const latinDigits = (s: string) =>
  s.replace(AR_DIGITS, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d) >= 0 ? "٠١٢٣٤٥٦٧٨٩".indexOf(d) : "۰۱۲۳۴۵۶۷۸۹".indexOf(d)));

/** Normalize Arabic for matching: strip tashkeel/tatweel, unify alef/ya/ta-marbuta forms, lowercase. */
export function normalizeAr(s: string) {
  return latinDigits(s)
    .replace(/[ً-ٰٟـ]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .toLowerCase()
    .trim();
}
