import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import type { Enquiry, EnquiryStatus } from "@/types/database";

/** Admin-only: every enquiry, optionally filtered by status. */
export async function getAdminEnquiries(status?: EnquiryStatus): Promise<Enquiry[]> {
  const supabase = await createClient();
  let query = supabase.from("enquiries").select("*").order("created_at", { ascending: false });
  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) {
    logger.warn("failed to load admin enquiries", { message: error.message });
    return [];
  }
  return (data ?? []) as Enquiry[];
}

export async function getAdminEnquiry(id: string): Promise<Enquiry | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("enquiries").select("*").eq("id", id).single();
  if (error || !data) return null;
  return data as Enquiry;
}
