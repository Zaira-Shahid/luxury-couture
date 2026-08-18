import { createClient } from "@supabase/supabase-js";

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data, error } = await admin.auth.admin.listUsers();
if (error) throw error;

const testUsers = data.users.filter((u) => u.email?.includes("@luxury-couture-devtest.local"));
for (const u of testUsers) {
  await admin.auth.admin.deleteUser(u.id);
  console.log(`deleted ${u.email}`);
}
console.log(`\n${testUsers.length} test user(s) cleaned up.`);
