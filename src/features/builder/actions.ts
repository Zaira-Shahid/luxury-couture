"use server";

import { logger } from "@/lib/logger";
import { notify } from "@/lib/notifications/notify";
import { enquiryReceivedTemplate } from "@/lib/notifications/templates";
import { createClient } from "@/lib/supabase/server";
import { validateImageFile } from "@/lib/storage/validate-file";
import { deleteFromStorage, randomStoragePath, uploadToStorage } from "@/lib/storage/upload-to-storage";
import { builderSelectionsSchema, requestQuotationSchema } from "@/lib/validations/builder";
import type { BuilderConfiguration, InspirationImage } from "@/types/database";

export type ActionResult<T = undefined> = { error: string } | { success: true; data: T };

type SelectionsInput = {
  productId?: string | null;
  fabricId?: string | null;
  embroideryTypeId?: string | null;
  colourId?: string | null;
  sleeveStyleId?: string | null;
  necklineId?: string | null;
  dupattaOptionId?: string | null;
  customNotes?: string | null;
};

function firstIssueMessage(error: { issues: { message: string }[] }) {
  return error.issues[0]?.message ?? "Invalid input.";
}

export async function createConfiguration(
  selections: SelectionsInput
): Promise<ActionResult<BuilderConfiguration>> {
  const parsed = builderSelectionsSchema.safeParse(selections);
  if (!parsed.success) return { error: firstIssueMessage(parsed.error) };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_builder_configuration", {
    p_product_id: parsed.data.productId,
    p_fabric_id: parsed.data.fabricId,
    p_embroidery_type_id: parsed.data.embroideryTypeId,
    p_colour_id: parsed.data.colourId,
    p_sleeve_style_id: parsed.data.sleeveStyleId,
    p_neckline_id: parsed.data.necklineId,
    p_dupatta_option_id: parsed.data.dupattaOptionId,
    p_custom_notes: parsed.data.customNotes,
  });

  if (error || !data) {
    logger.error("builder configuration create failed", error);
    return { error: "Could not save your design. Please try again." };
  }
  return { success: true, data: data as BuilderConfiguration };
}

export async function updateConfiguration(
  id: string,
  token: string,
  selections: SelectionsInput
): Promise<ActionResult<BuilderConfiguration>> {
  const parsed = builderSelectionsSchema.safeParse(selections);
  if (!parsed.success) return { error: firstIssueMessage(parsed.error) };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("update_builder_configuration", {
    p_id: id,
    p_token: token,
    p_product_id: parsed.data.productId,
    p_fabric_id: parsed.data.fabricId,
    p_embroidery_type_id: parsed.data.embroideryTypeId,
    p_colour_id: parsed.data.colourId,
    p_sleeve_style_id: parsed.data.sleeveStyleId,
    p_neckline_id: parsed.data.necklineId,
    p_dupatta_option_id: parsed.data.dupattaOptionId,
    p_custom_notes: parsed.data.customNotes,
  });

  if (error || !data) {
    logger.error("builder configuration update failed", error, { id });
    return { error: "This design link looks invalid, or something went wrong saving." };
  }
  return { success: true, data: data as BuilderConfiguration };
}

export async function claimConfiguration(
  id: string,
  token: string
): Promise<ActionResult<BuilderConfiguration>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("claim_builder_configuration", {
    p_id: id,
    p_token: token,
  });

  if (error || !data) {
    logger.warn("builder configuration claim failed", { message: error?.message, id });
    return { error: error?.message ?? "Could not save this design to your account." };
  }
  return { success: true, data: data as BuilderConfiguration };
}

export async function addInspirationImage(
  configId: string,
  token: string,
  formData: FormData
): Promise<ActionResult<InspirationImage>> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose an image to upload." };
  }
  const validationError = validateImageFile(file);
  if (validationError) return { error: validationError };

  const supabase = await createClient();

  // Confirms the id+token match *before* touching Storage — the RPC would
  // catch a bad token too, but there's no point uploading a file first
  // just to have the DB insert reject it afterwards.
  const { data: existing } = await supabase.rpc("get_builder_configuration", {
    p_id: configId,
    p_token: token,
  });
  if (!existing?.length) return { error: "This design link looks invalid." };

  const path = randomStoragePath(`inspiration/${configId}`, file);
  const uploaded = await uploadToStorage("inspiration-images", path, file);
  if ("error" in uploaded) {
    logger.error("inspiration image upload failed", new Error(uploaded.error), { configId });
    return { error: "Could not upload that image. Please try again." };
  }

  const { data, error } = await supabase.rpc("add_inspiration_image", {
    p_config_id: configId,
    p_token: token,
    p_url: uploaded.url,
    p_storage_path: uploaded.path,
  });

  if (error || !data) {
    logger.error("inspiration image record failed", error, { configId });
    await deleteFromStorage("inspiration-images", uploaded.path);
    return { error: "Could not add that image. Please try again." };
  }

  return { success: true, data: data as InspirationImage };
}

export async function removeInspirationImage(
  imageId: string,
  token: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("remove_inspiration_image", {
    p_image_id: imageId,
    p_token: token,
  });

  if (error || !data) {
    logger.error("inspiration image remove failed", error, { imageId });
    return { error: "Could not remove that image. Please try again." };
  }

  const deleted = data as InspirationImage;
  if (deleted.storage_path) {
    await deleteFromStorage("inspiration-images", deleted.storage_path);
  }

  return { success: true, data: undefined };
}

export async function requestQuotation(
  configId: string,
  token: string,
  formData: FormData
): Promise<ActionResult> {
  const parsed = requestQuotationSchema.safeParse({
    contactName: formData.get("contactName"),
    contactEmail: formData.get("contactEmail"),
    contactPhone: formData.get("contactPhone"),
  });
  if (!parsed.success) return { error: firstIssueMessage(parsed.error) };

  const supabase = await createClient();

  const { data: config, error: statusErr } = await supabase.rpc("update_builder_configuration", {
    p_id: configId,
    p_token: token,
    p_status: "submitted",
  });
  if (statusErr || !config) {
    logger.error("builder configuration submit failed", statusErr, { configId });
    return { error: "This design link looks invalid." };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // No .select() deliberately — guests (customer_id null) can never pass
  // enquiries' SELECT policy for their own row (0021), and Postgres
  // requires RETURNING output to satisfy it too. Same pattern documented
  // for newsletter signups and product enquiries.
  const { error: enquiryErr } = await supabase.from("enquiries").insert({
    customer_id: user?.id ?? null,
    builder_configuration_id: configId,
    type: "builder",
    contact_name: parsed.data.contactName,
    contact_email: parsed.data.contactEmail,
    contact_phone: parsed.data.contactPhone,
    message: `Quotation requested for a custom design (estimated £${config.estimated_price ?? "0"}). Design link: /builder/${configId}?token=${token}`,
  });

  if (enquiryErr) {
    logger.error("builder quotation enquiry failed", enquiryErr, { configId });
    return { error: "Could not submit your request. Please try again." };
  }

  await notify(supabase, {
    profileId: user?.id ?? null,
    email: user?.email ?? parsed.data.contactEmail,
    phone: parsed.data.contactPhone || null,
    ...enquiryReceivedTemplate(),
  });

  return { success: true, data: undefined };
}
