type Item = { id: string; supplierId: string | null };
type Shipment = { id: string; supplierId: string | null };

export function customerOrderTracking<I extends Item, S extends Shipment, O extends { orderItems: I[]; shipments: S[] }>(order: O) {
  const { orderItems, shipments, ...details } = order;
  const safeShipment = ({ supplierId: _supplierId, ...shipment }: S) => shipment;
  const attached = new Set<string>();
  const items = orderItems.map(({ supplierId, ...item }) => {
    const matching = shipments.filter(shipment => shipment.supplierId && supplierId
      ? shipment.supplierId === supplierId
      : orderItems.length === 1);
    matching.forEach(shipment => attached.add(shipment.id));
    return { ...item, shipments: matching.map(shipment => ({ ...safeShipment(shipment), shared: orderItems.filter(other => shipment.supplierId && other.supplierId === shipment.supplierId).length > 1 })) };
  });
  return { ...details, orderItems: items, shipments: shipments.map(safeShipment), unassignedShipments: shipments.filter(shipment => !attached.has(shipment.id)).map(safeShipment) };
}
