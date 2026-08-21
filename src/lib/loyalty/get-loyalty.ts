import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import type { LoyaltyAccount, LoyaltyTransaction } from "@/types/database";

export type LoyaltySummary = { account: LoyaltyAccount | null; transactions: LoyaltyTransaction[] };

/** The signed-in customer's own loyalty account + recent transactions. */
export async function getMyLoyaltyAccount(): Promise<LoyaltySummary> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { account: null, transactions: [] };

  const { data: account, error: accountError } = await supabase
    .from("loyalty_accounts")
    .select("*")
    .eq("customer_id", user.id)
    .maybeSingle();
  if (accountError) logger.warn("failed to load loyalty account", { message: accountError.message });
  if (!account) return { account: null, transactions: [] };

  const { data: transactions, error: txError } = await supabase
    .from("loyalty_transactions")
    .select("*")
    .eq("loyalty_account_id", account.id)
    .order("created_at", { ascending: false })
    .limit(50);
  if (txError) logger.warn("failed to load loyalty transactions", { message: txError.message });

  return { account: account as LoyaltyAccount, transactions: (transactions ?? []) as LoyaltyTransaction[] };
}
