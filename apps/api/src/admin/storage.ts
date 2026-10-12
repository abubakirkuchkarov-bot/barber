import { randomBytes } from "node:crypto";

const BUCKET = "barber-media";

export async function storeImage(bytes: Buffer, contentType: string, folder: string) {
  const base = process.env.SUPABASE_URL?.replace(/\/$/, "") ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!base || !key) return null;
  const extension = contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg";
  const path = `${folder}/${randomBytes(12).toString("hex")}.${extension}`;
  await ensureBucket(base, key);
  const response = await fetch(`${base}/storage/v1/object/${BUCKET}/${path}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${key}`,
      apikey: key,
      "content-type": contentType,
      "x-upsert": "true",
    },
    body: new Uint8Array(bytes),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail.replaceAll(key, "[key]"));
  }
  return `${base}/storage/v1/object/public/${BUCKET}/${path}`;
}

async function ensureBucket(base: string, key: string) {
  const response = await fetch(`${base}/storage/v1/bucket`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${key}`,
      apikey: key,
      "content-type": "application/json",
    },
    body: JSON.stringify({ id: BUCKET, name: BUCKET, public: true }),
  });
  if (response.ok || response.status === 409) return;
  const detail = await response.text();
  if (detail.toLowerCase().includes("already exists")) return;
  throw new Error(detail.replaceAll(key, "[key]"));
}
