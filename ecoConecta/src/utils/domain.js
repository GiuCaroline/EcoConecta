export function materialNames(ids, materials) {
  return ids
    .map((id) => materials.find((item) => item.id === id)?.name || id)
    .join(" · ");
}
export function acceptsMaterials(point, ids) {
  return point.active && ids.every((id) => point.materials.includes(id));
}
export function parseQuantity(value) {
  const number = Number(String(value).trim().replace(",", "."));
  return Number.isFinite(number) && number > 0 ? number : null;
}
export function parseDate(value) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  if (!match) return null;
  const [, day, month, year] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  if (
    date.getFullYear() !== Number(year) ||
    date.getMonth() !== Number(month) - 1 ||
    date.getDate() !== Number(day)
  )
    return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date >= today ? date : null;
}
export function canAdvance(request, role, userId, ownedPointIds) {
  if (request.cancelled) return false;
  if (role === "driver")
    return (
      request.driverId === userId &&
      (request.status === 1 || request.status === 2)
    );
  return (
    role === "point" &&
    request.status === 3 &&
    ownedPointIds.includes(request.pointId)
  );
}
