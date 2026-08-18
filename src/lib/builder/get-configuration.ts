import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import type { BuilderConfiguration, InspirationImage } from "@/types/database";

/**
 * Loads a configuration by id+token via the same token-gated RPC guests
 * use — works uniformly whether the caller is the owner, a guest with the
 * link, or a different signed-in account viewing a shared link. Not
 * request-cached: this is called at most once per page load here.
 */
export async function getBuilderConfiguration(
  id: string,
  token: string
): Promise<BuilderConfiguration | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_builder_configuration", {
    p_id: id,
    p_token: token,
  });

  if (error) {
    logger.warn("failed to load builder configuration", { message: error.message, id });
    return null;
  }
  return (data?.[0] as BuilderConfiguration | undefined) ?? null;
}

export async function getInspirationImages(
  configId: string,
  token: string
): Promise<InspirationImage[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_inspiration_images", {
    p_config_id: configId,
    p_token: token,
  });

  if (error) {
    logger.warn("failed to load inspiration images", { message: error.message, configId });
    return [];
  }
  return (data ?? []) as InspirationImage[];
}
