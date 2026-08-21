import { MockInstagramProvider } from "./mock-provider";
import type { InstagramProvider } from "./provider";

export type { InstagramProvider, SocialPost } from "./provider";

export function getInstagramProvider(): InstagramProvider {
  return new MockInstagramProvider();
}
