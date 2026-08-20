import { MockShippingProvider } from "./mock-provider";
import type { ShippingProvider } from "./provider";

export type { ShippingProvider, ShipmentAddress, CreateShipmentResult } from "./provider";

export function getShippingProvider(): ShippingProvider {
  return new MockShippingProvider();
}
