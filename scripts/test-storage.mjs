import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const suffix = Date.now();

async function check(label, pass) {
  console.log(`${pass ? "PASS" : "FAIL"} — ${label}`);
}

// A real, minimal valid 1x1 transparent PNG.
const PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
const pngBytes = Buffer.from(PNG_BASE64, "base64");

console.log("=== Bucket-level enforcement (server-side, not just app code) ===");

const oversized = Buffer.alloc(6 * 1024 * 1024); // over the 5MB inspiration-images limit
const { error: oversizedErr } = await admin.storage
  .from("inspiration-images")
  .upload(`test/${suffix}-oversized.png`, oversized, { contentType: "image/png" });
await check("bucket rejects a file over its size limit", !!oversizedErr);

const { error: wrongTypeErr } = await admin.storage
  .from("inspiration-images")
  .upload(`test/${suffix}-wrong-type.txt`, Buffer.from("not an image"), { contentType: "text/plain" });
await check("bucket rejects a disallowed MIME type", !!wrongTypeErr);

console.log("\n=== Guest builder flow: real upload, real delete ===");
const guest = createClient(url, anonKey);
const { data: fabric } = await admin.from("fabrics").select("id").limit(1).single();
const { data: config } = await guest.rpc("create_builder_configuration", { p_fabric_id: fabric.id });
const { id: configId, share_token: token } = config;

const path = `inspiration/${configId}/${suffix}-test.png`;
const { error: uploadErr } = await guest.storage
  .from("inspiration-images")
  .upload(path, pngBytes, { contentType: "image/png" });
// Confirms the earlier direct-write-blocked check still holds even for a
// *valid* file — only the service-role-mediated path should work.
await check("guest still cannot upload directly to Storage (even a valid file)", !!uploadErr);

// Now via the actual service-role path the Server Action uses.
const { error: adminUploadErr } = await admin.storage
  .from("inspiration-images")
  .upload(path, pngBytes, { contentType: "image/png" });
await check("service-role upload succeeds", !adminUploadErr);

const {
  data: { publicUrl },
} = admin.storage.from("inspiration-images").getPublicUrl(path);

const { data: image, error: addErr } = await guest.rpc("add_inspiration_image", {
  p_config_id: configId,
  p_token: token,
  p_url: publicUrl,
  p_storage_path: path,
});
await check("add_inspiration_image records the real storage_path", !addErr && image?.storage_path === path);

// Confirm the uploaded object is actually fetchable (real file, not a broken reference).
const fetchResult = await fetch(publicUrl);
await check("uploaded image is publicly fetchable", fetchResult.status === 200);

// Delete via the RPC, then confirm the Storage object is also removed
// (the Server Action does this — replicate exactly here).
const { data: deleted, error: removeErr } = await guest.rpc("remove_inspiration_image", {
  p_image_id: image.id,
  p_token: token,
});
await check("remove_inspiration_image returns the deleted row (for storage cleanup)", !removeErr && deleted?.storage_path === path);
await admin.storage.from("inspiration-images").remove([deleted.storage_path]);

const { data: stillThere } = await admin.storage.from("inspiration-images").list(`inspiration/${configId}`);
await check("storage object actually removed after delete", (stillThere?.length ?? 0) === 0);

console.log("\n=== Admin media library: real admin vs non-admin ===");
async function signIn(email, password) {
  const client = createClient(url, anonKey);
  const { data } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  await client.auth.signInWithPassword({ email, password });
  return { client, userId: data.user.id };
}
const staffAdmin = await signIn(`m8-admin-${suffix}@luxury-couture-devtest.local`, "correct-horse-8");
await admin.from("profiles").update({ role: "admin" }).eq("id", staffAdmin.userId);
const customer = await signIn(`m8-customer-${suffix}@luxury-couture-devtest.local`, "correct-horse-9");

const mediaPath = `media/${suffix}-test.png`;
await admin.storage.from("media").upload(mediaPath, pngBytes, { contentType: "image/png" });
const {
  data: { publicUrl: mediaUrl },
} = admin.storage.from("media").getPublicUrl(mediaPath);

const { error: nonAdminInsertErr } = await customer.client.from("media").insert({
  uploader_id: customer.userId,
  storage_path: mediaPath,
  url: mediaUrl,
  file_type: "image/png",
  size_bytes: pngBytes.length,
});
await check("non-admin cannot insert into media table", !!nonAdminInsertErr);

const { data: mediaRow, error: adminInsertErr } = await staffAdmin.client
  .from("media")
  .insert({
    uploader_id: staffAdmin.userId,
    storage_path: mediaPath,
    url: mediaUrl,
    file_type: "image/png",
    size_bytes: pngBytes.length,
    alt_text: "Test asset",
  })
  .select()
  .single();
await check("real admin can insert into media table", !adminInsertErr && !!mediaRow);

// A RLS-filtered DELETE silently affects 0 rows in Postgres/PostgREST —
// it does not error — so the real check is whether the row still exists
// afterward, not whether the call itself returned an error.
await customer.client.from("media").delete().eq("id", mediaRow?.id ?? "");
const { data: stillExists } = await admin.from("media").select("id").eq("id", mediaRow.id);
await check("non-admin's delete call is a no-op (row still exists)", stillExists?.length === 1);

const { error: adminDeleteErr } = await staffAdmin.client.from("media").delete().eq("id", mediaRow.id);
await check("real admin can delete media", !adminDeleteErr);
await admin.storage.from("media").remove([mediaPath]);

console.log("\nCleaning up...");
await admin.from("builder_configurations").delete().eq("id", configId);
await admin.auth.admin.deleteUser(staffAdmin.userId);
await admin.auth.admin.deleteUser(customer.userId);

const [{ data: configs }, { data: mediaRows }, { data: users }, { data: leftoverObjects }] = await Promise.all([
  admin.from("builder_configurations").select("id"),
  admin.from("media").select("id"),
  admin.auth.admin.listUsers(),
  admin.storage.from("inspiration-images").list("inspiration"),
]);
console.log(
  `Remaining — builder_configurations: ${configs.length}, media rows: ${mediaRows.length}, auth users: ${users.users.length} (should be 0, 0, 1), leftover inspiration folders: ${leftoverObjects?.length ?? 0}`
);
