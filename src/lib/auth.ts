export const AUTH_COOKIE = "jimeng_session";

function getAuthSecret() {
  return process.env.AUTH_SECRET || "jimeng-dev-secret";
}

const encoder = new TextEncoder();

function toBase64Url(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function fromBase64Url(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function timingSafeEqualString(left: string, right: string) {
  if (left.length !== right.length) {
    return false;
  }

  let diff = 0;
  for (let i = 0; i < left.length; i += 1) {
    diff |= left.charCodeAt(i) ^ right.charCodeAt(i);
  }
  return diff === 0;
}

async function sign(value: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(getAuthSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export type SessionPayload = {
  email: string;
  name: string;
};

export async function createSessionToken(payload: SessionPayload) {
  const raw = toBase64Url(JSON.stringify(payload));
  const signature = await sign(raw);
  return `${raw}.${signature}`;
}

export async function parseSessionToken(token: string | undefined) {
  if (!token) {
    return null;
  }

  const [raw, signature] = token.split(".");
  if (!raw || !signature) {
    return null;
  }

  const expected = await sign(raw);

  if (!timingSafeEqualString(expected, signature)) {
    return null;
  }

  try {
    const json = fromBase64Url(raw);
    const payload = JSON.parse(json) as SessionPayload;
    if (!payload.email || !payload.name) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
