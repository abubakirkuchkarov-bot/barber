export function cronAuth(header: string | undefined, secret: string | undefined): "unconfigured" | "forbidden" | "ok" {
  if (!secret) return "unconfigured";
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : "";
  const left = new TextEncoder().encode(token);
  const right = new TextEncoder().encode(secret);
  if (left.length !== right.length) return "forbidden";
  let diff = 0;
  for (let index = 0; index < left.length; index += 1) diff |= (left[index] ?? 0) ^ (right[index] ?? 0);
  return diff === 0 ? "ok" : "forbidden";
}
