export type ShipmentAddress = {
  city: string;
  region: string | null;
  postalCode: string;
  country: string;
};

export type CreateShipmentResult = {
  trackingNumber: string;
  courier: string;
  /** Major currency unit (e.g. GBP pounds); informational only — never charged to the customer. */
  cost: number;
};

/**
 * Free-first provider abstraction (Master Build Plan §3), same pattern as
 * lib/payments/. Only a mock implementation exists — no real courier API
 * credentials exist to integrate against, same deferral as Module 11's
 * PayPal decision. A real courier (Royal Mail, DHL, etc.) can implement
 * this same interface later without touching call sites.
 */
export interface ShippingProvider {
  createShipment(address: ShipmentAddress): Promise<CreateShipmentResult>;
}
