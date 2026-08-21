import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import type { Quotation } from "@/types/database";

export type AdminQuotation = Quotation & {
  enquiries: { contact_name: string } | null;
};

/** Admin-only: every quotation across every enquiry. */
export async function getAdminQuotations(): Promise<AdminQuotation[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quotations")
    .select("*, enquiries(contact_name)")
    .order("created_at", { ascending: false });

  if (error) {
    logger.warn("failed to load admin quotations", { message: error.message });
    return [];
  }
  return (data ?? []) as unknown as AdminQuotation[];
}
