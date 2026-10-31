/**
 * Turn a stored sentence into a clause that reads mid-sentence: lowercase the
 * first letter and drop the trailing period. Only the first letter changes, so
 * product names (VendorLine, SAM.gov) keep their case, and a leading acronym
 * (RFP, AI) is left alone.
 */
export const asClause = (s: string): string => {
  const t = s.trim().replace(/\.$/, '');
  // Keep a first word with a second capital: an acronym (RFP) or a CamelCase
  // product name (VendorLine).
  return /^[A-Z]\S*[A-Z]/.test(t.split(' ')[0]) ? t : t.charAt(0).toLowerCase() + t.slice(1);
};
