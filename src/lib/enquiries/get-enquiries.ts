import { readFailed, readerClient, type ReaderOptions } from "@/lib/supabase/reader";
import type { Enquiry, EnquiryStatus } from "@/types/database";

/** Admin-only: every enquiry, optionally filtered by status. */
export async function getAdminEnquiries(
  status?: EnquiryStatus,
  options?: ReaderOptions
): Promise<Enquiry[]> {
  const supabase = await readerClient(options);
  let query = supabase.from("enquiries").select("*").order("created_at", { ascending: false });
  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) return readFailed(error, options, [], "failed to load admin enquiries");
  return (data ?? []) as Enquiry[];
}

export async function getAdminEnquiry(
  id: string,
  options?: ReaderOptions
): Promise<Enquiry | null> {
  const supabase = await readerClient(options);
  const { data, error } = await supabase.from("enquiries").select("*").eq("id", id).single();
  if (error || !data) {
    if (error && options?.throwOnError) throw error;
    return null;
  }
  return data as Enquiry;
}
