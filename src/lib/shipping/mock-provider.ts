import type { CreateShipmentResult, ShipmentAddress, ShippingProvider } from "./provider";

const UK_COURIER = "Royal Mail Tracked";
const INTERNATIONAL_COURIER = "DHL Express";
const UK_RATE = 8.5;
const INTERNATIONAL_RATE = 32;

function isUK(country: string) {
  const normalized = country.trim().toLowerCase();
  return normalized === "uk" || normalized === "united kingdom" || normalized === "gb" || normalized === "great britain";
}

/**
 * Mock rates/tracking (Module 14's "Development" scope) — a simple
 * flat-by-destination rule, not a real rates engine. Real courier
 * integration is architecturally supported by the ShippingProvider
 * interface but not implemented.
 */
export class MockShippingProvider implements ShippingProvider {
  async createShipment(address: ShipmentAddress): Promise<CreateShipmentResult> {
    const uk = isUK(address.country);
    const trackingNumber = `MOCK${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 1000)}`;
    return {
      trackingNumber,
      courier: uk ? UK_COURIER : INTERNATIONAL_COURIER,
      cost: uk ? UK_RATE : INTERNATIONAL_RATE,
    };
  }
}
