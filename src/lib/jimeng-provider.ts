import { createHash, createHmac } from "crypto";

import type { Shot } from "@/lib/project-store";

type ProviderImageResult = {
  ok: boolean;
  imageUrl?: string;
  providerMessage: string;
  raw?: unknown;
};

function getEnv(name: string) {
  return process.env[name]?.trim() || "";
}

function hasOfficialVisualConfig() {
  return getEnv("JIMENG_ACCESS_KEY") !== "" && getEnv("JIMENG_SECRET_KEY") !== "";
}

function hasGenericConfig() {
  return getEnv("JIMENG_IMAGE_ENDPOINT") !== "" && getEnv("JIMENG_API_KEY") !== "";
}

function isRealMode() {
  return hasOfficialVisualConfig() || hasGenericConfig();
}

function mapAspectRatioToSize(aspectRatio: Shot["aspectRatio"]) {
  switch (aspectRatio) {
    case "16:9":
      return "1280x720";
    case "1:1":
      return "1024x1024";
    case "9:16":
    default:
      return "720x1280";
  }
}

function extractImageUrl(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const data = payload as Record<string, unknown>;
  const direct = typeof data.url === "string" ? data.url : null;
  if (direct) {
    return direct;
  }

  const candidates = [
    data.image_url,
    data.imageUrl,
    data.result,
    data.output,
    data.data,
    data.images
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string") {
      return candidate;
    }

    if (Array.isArray(candidate) && candidate.length > 0) {
      const first = candidate[0];
      if (typeof first === "string") {
        return first;
      }
      if (first && typeof first === "object") {
        const objectFirst = first as Record<string, unknown>;
        const nested = objectFirst.url || objectFirst.image_url || objectFirst.imageUrl;
        if (typeof nested === "string") {
          return nested;
        }
      }
    }

    if (candidate && typeof candidate === "object") {
      const nested = extractImageUrl(candidate);
      if (nested) {
        return nested;
      }
    }
  }

  return null;
}

export function isJimengRealImageEnabled() {
  return isRealMode();
}

function buildCanonicalQuery(params: Record<string, string>) {
  return Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");
}

function sha256Hex(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function hmac(key: Buffer | string, value: string) {
  return createHmac("sha256", key).update(value, "utf8").digest();
}

function getDateParts() {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(now.getUTCDate()).padStart(2, "0");
  const hh = String(now.getUTCHours()).padStart(2, "0");
  const mi = String(now.getUTCMinutes()).padStart(2, "0");
  const ss = String(now.getUTCSeconds()).padStart(2, "0");
  const dateTime = `${yyyy}${mm}${dd}T${hh}${mi}${ss}Z`;
  return {
    dateTime,
    shortDate: dateTime.slice(0, 8)
  };
}

function getSigningKey(secretKey: string, date: string, region: string, service: string) {
  const kDate = hmac(secretKey, date);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  return hmac(kService, "request");
}

function buildSignedHeaders(sessionToken?: string) {
  const headers = ["content-type", "host", "x-content-sha256", "x-date"];
  if (sessionToken) {
    headers.push("x-security-token");
  }
  return headers.join(";");
}

async function callVisualApi(action: "CVSync2AsyncSubmitTask" | "CVSync2AsyncGetResult", body: Record<string, unknown>) {
  const endpoint = "https://visual.volcengineapi.com";
  const host = "visual.volcengineapi.com";
  const region = "cn-north-1";
  const service = "cv";
  const version = "2022-08-31";
  const contentType = "application/json";
  const payload = JSON.stringify(body);
  const params = {
    Action: action,
    Version: version
  };

  const accessKey = getEnv("JIMENG_ACCESS_KEY");
  const secretKey = getEnv("JIMENG_SECRET_KEY");
  const sessionToken = getEnv("JIMENG_SESSION_TOKEN");
  const { dateTime, shortDate } = getDateParts();
  const canonicalQuery = buildCanonicalQuery(params);
  const payloadHash = sha256Hex(payload);
  const signedHeaders = buildSignedHeaders(sessionToken || undefined);
  const canonicalHeaders =
    `content-type:${contentType}\n` +
    `host:${host}\n` +
    `x-content-sha256:${payloadHash}\n` +
    `x-date:${dateTime}\n` +
    (sessionToken ? `x-security-token:${sessionToken}\n` : "");

  const canonicalRequest =
    "POST\n/\n" +
    `${canonicalQuery}\n` +
    `${canonicalHeaders}\n` +
    `${signedHeaders}\n` +
    `${payloadHash}`;

  const credentialScope = `${shortDate}/${region}/${service}/request`;
  const stringToSign =
    "HMAC-SHA256\n" +
    `${dateTime}\n` +
    `${credentialScope}\n` +
    `${sha256Hex(canonicalRequest)}`;

  const signature = createHmac("sha256", getSigningKey(secretKey, shortDate, region, service))
    .update(stringToSign, "utf8")
    .digest("hex");

  const headers: Record<string, string> = {
    "Content-Type": contentType,
    "X-Date": dateTime,
    "X-Content-Sha256": payloadHash,
    Authorization: `HMAC-SHA256 Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`
  };

  if (sessionToken) {
    headers["X-Security-Token"] = sessionToken;
  }

  const response = await fetch(`${endpoint}?${canonicalQuery}`, {
    method: "POST",
    headers,
    body: payload
  });

  const rawText = await response.text();
  let data: unknown = null;

  try {
    data = rawText ? JSON.parse(rawText) : null;
  } catch {
    data = rawText;
  }

  return {
    ok: response.ok,
    status: response.status,
    data
  };
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function generateJimengImageOfficial(shot: Shot): Promise<ProviderImageResult> {
  const widthHeightMap: Record<Shot["aspectRatio"], { width: number; height: number }> = {
    "1:1": { width: 1328, height: 1328 },
    "16:9": { width: 1664, height: 936 },
    "9:16": { width: 936, height: 1664 }
  };

  const size = widthHeightMap[shot.aspectRatio];
  const submitBody = {
    req_key: "jimeng_t2i_v31",
    prompt: shot.prompt || shot.description || shot.title,
    use_pre_llm: true,
    seed: -1,
    width: size.width,
    height: size.height
  };

  const submitResult = await callVisualApi("CVSync2AsyncSubmitTask", submitBody);
  const submitPayload = submitResult.data as { code?: number; message?: string; request_id?: string; data?: { task_id?: string } } | null;

  if (!submitResult.ok || submitPayload?.code !== 10000 || !submitPayload?.data?.task_id) {
    return {
      ok: false,
      providerMessage: `Jimeng submit failed: ${submitPayload?.message || `HTTP ${submitResult.status}`}${
        submitPayload?.request_id ? ` (request_id: ${submitPayload.request_id})` : ""
      }`,
      raw: submitResult.data
    };
  }

  const maxAttempts = Number.parseInt(getEnv("JIMENG_POLL_MAX_ATTEMPTS") || "10", 10);
  const pollIntervalMs = Number.parseInt(getEnv("JIMENG_POLL_INTERVAL_MS") || "1500", 10);
  const reqJson = JSON.stringify({
    return_url: true,
    logo_info: {
      add_logo: false,
      position: 0,
      language: 0,
      opacity: 1
    }
  });

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const pollResult = await callVisualApi("CVSync2AsyncGetResult", {
      req_key: "jimeng_t2i_v31",
      task_id: submitPayload.data.task_id,
      req_json: reqJson
    });

    const pollPayload = pollResult.data as
      | { code?: number; message?: string; request_id?: string; data?: { status?: string; image_urls?: string[] } }
      | null;

    if (!pollResult.ok || pollPayload?.code !== 10000) {
      return {
        ok: false,
        providerMessage: `Jimeng polling failed: ${pollPayload?.message || `HTTP ${pollResult.status}`}${
          pollPayload?.request_id ? ` (request_id: ${pollPayload.request_id})` : ""
        }`,
        raw: pollResult.data
      };
    }

    const taskStatus = pollPayload.data?.status;

    if (taskStatus === "done") {
      const imageUrl = pollPayload.data?.image_urls?.[0];
      if (!imageUrl) {
        return {
          ok: false,
          providerMessage: "Jimeng task finished but no image URL was returned.",
          raw: pollResult.data
        };
      }

      return {
        ok: true,
        imageUrl,
        providerMessage: "Jimeng image generated successfully.",
        raw: pollResult.data
      };
    }

    if (taskStatus === "not_found" || taskStatus === "expired") {
      return {
        ok: false,
        providerMessage: `Jimeng task status: ${taskStatus}`,
        raw: pollResult.data
      };
    }

    await sleep(pollIntervalMs);
  }

  return {
    ok: false,
    providerMessage: "Jimeng polling timed out before task completed."
  };
}

async function generateJimengImageGeneric(shot: Shot): Promise<ProviderImageResult> {
  const endpoint = getEnv("JIMENG_IMAGE_ENDPOINT");
  const apiKey = getEnv("JIMENG_API_KEY");
  const model = getEnv("JIMENG_IMAGE_MODEL") || "jimeng-3.1";

  const prompt = shot.prompt || shot.description || shot.title;
  const requestBody = {
    model,
    prompt,
    size: mapAspectRatioToSize(shot.aspectRatio),
    aspect_ratio: shot.aspectRatio
  };

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify(requestBody)
  });

  const rawText = await response.text();
  let payload: unknown = null;

  try {
    payload = rawText ? JSON.parse(rawText) : null;
  } catch {
    payload = rawText;
  }

  if (!response.ok) {
    return {
      ok: false,
      providerMessage: `Jimeng request failed with HTTP ${response.status}.`,
      raw: payload
    };
  }

  const imageUrl = extractImageUrl(payload);

  if (!imageUrl) {
    return {
      ok: false,
      providerMessage: "Jimeng response did not contain a usable image URL.",
      raw: payload
    };
  }

  return {
    ok: true,
    imageUrl,
    providerMessage: "Jimeng image generated successfully.",
    raw: payload
  };
}

export async function generateJimengImage(shot: Shot): Promise<ProviderImageResult> {
  if (!isRealMode()) {
    return {
      ok: false,
      providerMessage: "Jimeng real mode is not configured."
    };
  }

  if (hasOfficialVisualConfig()) {
    return generateJimengImageOfficial(shot);
  }

  return generateJimengImageGeneric(shot);
}
