export function userModel(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    phone: row.phone,
    address: row.address,
    vehicle: row.vehicle,
    plate: row.plate,
    online: row.online,
  };
}
export function pointModel(row) {
  return {
    id: row.id,
    owner: row.owner_id,
    name: row.name,
    address: row.address,
    phone: row.phone,
    hours: row.hours,
    description: row.description,
    materials: row.materials,
    active: row.active,
    icon: "business-outline",
  };
}
export const requestSelect = `SELECT r.*, u.name AS resident_name, d.name AS driver_name, p.owner_id FROM requests r JOIN users u ON u.id = r.resident_id LEFT JOIN users d ON d.id = r.driver_id JOIN points p ON p.id = r.point_id`;
export function requestModel(row, user) {
  const dateIso =
    typeof row.pickup_date === "string"
      ? row.pickup_date
      : row.pickup_date.toISOString().slice(0, 10);
  const hidden =
    user.role === "driver" && row.status === 0 && row.resident_id !== user.id;
  return {
    id: row.id,
    residentId: row.resident_id,
    residentName: hidden ? row.resident_name.split(" ")[0] : row.resident_name,
    pointId: row.point_id,
    pointName: row.point_name,
    pointAddress: row.point_address,
    driverId: row.driver_id,
    driverName: row.driver_name,
    materials: row.materials,
    quantity: Number(row.quantity),
    date: dateIso.split("-").reverse().join("/"),
    dateIso,
    period: row.period,
    address: hidden
      ? "Endereço disponível após aceitar a coleta."
      : row.address,
    notes: hidden ? "" : row.notes,
    status: row.status,
    cancelled: row.cancelled,
    createdAt: row.created_at,
  };
}
export function notificationModel(r) {
  return {
    id: r.id,
    requestId: r.request_id,
    title: r.title,
    body: r.body,
    read: r.read,
    createdAt: r.created_at,
  };
}
