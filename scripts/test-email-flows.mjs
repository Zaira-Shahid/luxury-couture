import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const email = `flowtest-${Date.now()}@luxury-couture-devtest.local`;
const password = "correct-horse-battery-5";

console.log("=== SIGNUP CONFIRMATION LINK ===");
const { data: signupLink, error: signupErr } = await admin.auth.admin.generateLink({
  type: "signup",
  email,
  password,
  options: { redirectTo: "http://localhost:3000/auth/callback" },
});
if (signupErr) throw signupErr;
console.log("action_link:", signupLink.properties.action_link);
console.log("verification_type:", signupLink.properties.verification_type);
console.log("hashed_token present:", !!signupLink.properties.hashed_token);

// Follow the link exactly as a browser would: GET the Supabase verify URL
// (don't auto-follow — need to inspect each hop).
let resp = await fetch(signupLink.properties.action_link, { redirect: "manual" });
console.log("\nHop 1 (Supabase /verify):", resp.status, resp.headers.get("location"));

const hop2Url = resp.headers.get("location");
if (hop2Url) {
  // The page itself (server-rendered shell) should load fine — the actual
  // session exchange happens client-side via useEffect, which this bare
  // fetch can't execute, so simulate that step directly below instead.
  resp = await fetch(hop2Url.split("#")[0]);
  console.log("Hop 2 page loads:", resp.status);

  const fragment = new URLSearchParams(hop2Url.split("#")[1]);
  const accessToken = fragment.get("access_token");
  const refreshToken = fragment.get("refresh_token");
  console.log("Fragment carries access_token/refresh_token:", !!accessToken, !!refreshToken);

  // Simulate what CallbackClient's setSession() call does.
  const browserSim = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: sessionData, error: setSessionErr } = await browserSim.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  console.log(
    "setSession() result: user=",
    sessionData?.user?.email,
    "error=",
    setSessionErr?.message ?? null
  );
}

// Confirm server-side: is the user now actually confirmed?
const { data: userCheck } = await admin.auth.admin.getUserById(signupLink.user.id);
console.log("\nemail_confirmed_at:", userCheck.user.email_confirmed_at);

console.log("\n=== PASSWORD RESET LINK ===");
const { data: recoveryLink, error: recoveryErr } = await admin.auth.admin.generateLink({
  type: "recovery",
  email,
  options: { redirectTo: "http://localhost:3000/auth/callback?next=/reset-password" },
});
if (recoveryErr) throw recoveryErr;
console.log("action_link:", recoveryLink.properties.action_link);

resp = await fetch(recoveryLink.properties.action_link, { redirect: "manual" });
console.log("\nHop 1 (Supabase /verify):", resp.status, resp.headers.get("location"));
const recoveryHop2 = resp.headers.get("location");
if (recoveryHop2) {
  resp = await fetch(recoveryHop2.split("#")[0]);
  console.log("Hop 2 page loads:", resp.status);

  const fragment = new URLSearchParams(recoveryHop2.split("#")[1]);
  const accessToken = fragment.get("access_token");
  const refreshToken = fragment.get("refresh_token");
  const browserSim = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: sessionData, error: setSessionErr } = await browserSim.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  console.log(
    "setSession() result: user=",
    sessionData?.user?.email,
    "error=",
    setSessionErr?.message ?? null
  );

  // Confirm updateUser (what resetPassword's Server Action calls) works
  // against this recovery session.
  const { error: updateErr } = await browserSim.auth.updateUser({ password: "new-correct-horse-6" });
  console.log("updateUser(password) result: error=", updateErr?.message ?? null);
}

await admin.auth.admin.deleteUser(signupLink.user.id);
console.log("\nCleaned up test user.");
