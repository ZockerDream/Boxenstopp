// Preise: Festpreise je Fahrzeugklasse, Rabatt der Preisgruppe. Ohne Datenbank, testbar.
export function unitPrice(item, classId) {
  if (item.class_prices && item.class_prices[classId] != null) return Number(item.class_prices[classId]);
  const s = (item.surcharge && item.surcharge[classId]) || 0;
  return Math.round(Number(item.price) * (1 + Number(s) / 100) * 100) / 100;
}
export function groupDiscount(group, item) {
  if (!group) return 0;
  if (group.cats && group.cats[item.category_id] != null) return Number(group.cats[item.category_id]);
  return Number(group.pct) || 0;
}
// Zeilensumme in Cent, kaufmännisch gerundet
export function lineCents(qty, unit, disc) {
  return Math.round(Number(qty) * Math.round(Number(unit) * 100) * (1 - Number(disc) / 100));
}
