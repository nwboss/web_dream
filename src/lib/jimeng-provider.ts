import { createHash, createHmac } from "crypto";

import type { Shot } from "@/lib/project-store";

type ProviderImageResult = {
  ok: boolean;
  imageUrl?: string;
  providerMessage: string;
  raw?: unknown;
};

type ProviderVideoResult = {
  ok: boolean;
  videoUrl?: string;
  providerMessage: string;
  taskId?: string;
  raw?: unknown;
};

type ImageGenerationInput = {
  shot: Shot;
  referenceImageBase64?: string;
};

export type MultimodalReference = {
  type: "image" | "video" | "audio";
  base64: string;
};

type VideoGenerationInput = {
  prompt: string;
  referenceImageBase64?: string;
  referenceEndImageBase64?: string;
  duration?: number;
  aspectRatio?: string;
  // Seedance 2.0 多模态参考
  multimodalReferences?: MultimodalReference[];
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

function hasArkConfig() {
  return getEnv("ARK_API_KEY") !== "" && getEnv("ARK_ENDPOINT") !== "";
}

function isRealMode() {
  return hasOfficialVisualConfig() || hasGenericConfig() || hasArkConfig();
}

function mapAspectRatioToSize(aspectRatio: Shot["aspectRatio"]) {
  switch (aspectRatio) {
    case "21:9":
      return "1848x792";
    case "16:9":
      return "1280x720";
    case "4:3":
      return "1280x960";
    case "1:1":
      return "1024x1024";
    case "3:4":
      return "960x1280";
    case "9:16":
    default:
      return "720x1280";
  }
}

function mapAspectRatioToSeedreamSize(aspectRatio: Shot["aspectRatio"]) {
  // Seedream 4.5 使用 "2K" 尺寸，宽高比通过 aspect_ratio 控制
  // 但API文档中只有 size 参数，可能需要固定为 "2K"
  return "2K";
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

async function generateJimengImageOfficial(input: ImageGenerationInput): Promise<ProviderImageResult> {
  const { shot, referenceImageBase64 } = input;
  const widthHeightMap: Record<Shot["aspectRatio"], { width: number; height: number }> = {
    "21:9": { width: 1848, height: 792 },
    "16:9": { width: 1664, height: 936 },
    "4:3": { width: 1328, height: 996 },
    "1:1": { width: 1328, height: 1328 },
    "3:4": { width: 996, height: 1328 },
    "9:16": { width: 936, height: 1664 }
  };

  const size = widthHeightMap[shot.aspectRatio];
  const submitBody = {
    req_key: referenceImageBase64 ? "jimeng_i2i_v30" : "jimeng_t2i_v31",
    prompt: shot.prompt || shot.description || shot.title,
    use_pre_llm: true,
    seed: -1,
    width: size.width,
    height: size.height,
    ...(referenceImageBase64 ? { binary_data_base64: [referenceImageBase64], scale: 0.5 } : {})
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

  const maxAttempts = Number.parseInt(getEnv("JIMENG_POLL_MAX_ATTEMPTS") || "40", 10);
  const pollIntervalMs = Number.parseInt(getEnv("JIMENG_POLL_INTERVAL_MS") || "2000", 10);
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
      req_key: referenceImageBase64 ? "jimeng_i2i_v30" : "jimeng_t2i_v31",
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
    providerMessage: `Jimeng polling timed out before task completed. waited about ${Math.round((maxAttempts * pollIntervalMs) / 1000)}s.`
  };
}

async function generateJimengImageGeneric(input: ImageGenerationInput): Promise<ProviderImageResult> {
  const { shot, referenceImageBase64 } = input;
  const endpoint = getEnv("JIMENG_IMAGE_ENDPOINT");
  const apiKey = getEnv("JIMENG_API_KEY");
  const model = getEnv("JIMENG_IMAGE_MODEL") || "jimeng-3.1";

  const prompt = shot.prompt || shot.description || shot.title;
  const requestBody = {
    model,
    prompt,
    size: mapAspectRatioToSize(shot.aspectRatio),
    aspect_ratio: shot.aspectRatio,
    ...(referenceImageBase64 ? { binary_data_base64: [referenceImageBase64] } : {})
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

async function generateSeedreamImage(input: ImageGenerationInput): Promise<ProviderImageResult> {
  const { shot } = input;
  const arkEndpoint = getEnv("ARK_ENDPOINT");
  const arkApiKey = getEnv("ARK_API_KEY");

  const prompt = shot.prompt || shot.description || shot.title;

  const requestBody = {
    model: "doubao-seedream-4-5-251128",
    prompt,
    sequential_image_generation: "disabled",
    response_format: "url",
    size: mapAspectRatioToSeedreamSize(shot.aspectRatio),
    stream: false,
    watermark: false
  };

  const response = await fetch(`${arkEndpoint}/images/generations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${arkApiKey}`
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
      providerMessage: `Seedream request failed with HTTP ${response.status}.`,
      raw: payload
    };
  }

  // Seedream API 返回格式：{ data: [{ url: "..." }] }
  const imageUrl = extractImageUrl(payload);

  if (!imageUrl) {
    return {
      ok: false,
      providerMessage: "Seedream response did not contain a usable image URL.",
      raw: payload
    };
  }

  return {
    ok: true,
    imageUrl,
    providerMessage: "Seedream image generated successfully.",
    raw: payload
  };
}

export async function generateJimengImage(shot: Shot, referenceImageBase64?: string, modelOverride?: string): Promise<ProviderImageResult> {
  if (!isRealMode()) {
    return {
      ok: false,
      providerMessage: "Jimeng real mode is not configured."
    };
  }

  const input: ImageGenerationInput = {
    shot,
    referenceImageBase64
  };

  // 优先使用modelOverride，其次使用环境变量
  const model = modelOverride || getEnv("JIMENG_IMAGE_MODEL") || "jimeng-3.1";

  // 如果选择了 Seedream 模型，使用火山方舟API
  if (model.includes("seedream")) {
    if (!hasArkConfig()) {
      return {
        ok: false,
        providerMessage: "Seedream models require ARK_API_KEY and ARK_ENDPOINT to be configured."
      };
    }
    return generateSeedreamImage(input);
  }

  if (hasOfficialVisualConfig()) {
    return generateJimengImageOfficial(input);
  }

  return generateJimengImageGeneric(input);
}

export function isJimengRealVideoEnabled() {
  return isRealMode();
}

async function generateJimengVideoOfficial(input: VideoGenerationInput): Promise<ProviderVideoResult> {
  const { prompt, referenceImageBase64, referenceEndImageBase64, duration = 5, aspectRatio = "16:9" } = input;

  // 根据时长计算帧数
  // 根据火山引擎文档：frames = 24 * n + 1，其中n为秒数
  // 1秒=25帧, 2秒=49帧, 3秒=73帧, 4秒=97帧, 5秒=121帧, 6秒=145帧, 7秒=169帧, 8秒=193帧, 9秒=217帧, 10秒=241帧
  const frames = duration * 24 + 1;

  // 确定req_key和binary_data
  // 根据火山引擎文档：https://www.volcengine.com/docs/85621/1785204
  let reqKey: string;
  let binaryData: string[] | undefined;

  if (referenceImageBase64 && referenceEndImageBase64) {
    // 首尾模式：文档中未提及，暂不支持
    console.warn("[Video Generation] First+Last frame mode is not documented");
    return {
      ok: false,
      providerMessage: "首尾帧模式暂不支持，请使用文生视频或首帧模式。"
    };
  } else if (referenceImageBase64) {
    // 首帧模式：jimeng_i2v_first_v30
    reqKey = "jimeng_i2v_first_v30";
    binaryData = [referenceImageBase64];
  } else {
    // 文生视频模式
    reqKey = "jimeng_t2v_v30";
    binaryData = undefined;
  }

  const submitBody = {
    req_key: reqKey,
    prompt,
    seed: -1,
    frames,
    aspect_ratio: aspectRatio,
    ...(binaryData ? { binary_data_base64: binaryData } : {})
  };

  const submitResult = await callVisualApi("CVSync2AsyncSubmitTask", submitBody);
  const submitPayload = submitResult.data as { code?: number; message?: string; request_id?: string; data?: { task_id?: string } } | null;

  if (!submitResult.ok || submitPayload?.code !== 10000 || !submitPayload?.data?.task_id) {
    return {
      ok: false,
      providerMessage: `Jimeng video submit failed: ${submitPayload?.message || `HTTP ${submitResult.status}`}${
        submitPayload?.request_id ? ` (request_id: ${submitPayload.request_id})` : ""
      }`,
      raw: submitResult.data
    };
  }

  const taskId = submitPayload.data.task_id;
  const maxAttempts = Number.parseInt(getEnv("JIMENG_VIDEO_POLL_MAX_ATTEMPTS") || "60", 10);
  const pollIntervalMs = Number.parseInt(getEnv("JIMENG_VIDEO_POLL_INTERVAL_MS") || "5000", 10);
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
      req_key: reqKey,
      task_id: taskId,
      req_json: reqJson
    });

    const pollPayload = pollResult.data as
      | { code?: number; message?: string; request_id?: string; data?: { status?: string; video_urls?: string[]; video_url?: string; url?: string; result_url?: string; [key: string]: unknown } }
      | null;

    if (!pollResult.ok || pollPayload?.code !== 10000) {
      return {
        ok: false,
        providerMessage: `Jimeng video polling failed: ${pollPayload?.message || `HTTP ${pollResult.status}`}${
          pollPayload?.request_id ? ` (request_id: ${pollPayload.request_id})` : ""
        }`,
        raw: pollResult.data
      };
    }

    const taskStatus = pollPayload.data?.status;

    if (taskStatus === "done") {
      // 根据API返回结构，优先使用video_url字段
      const videoUrl =
        pollPayload.data?.video_url ||
        pollPayload.data?.video_urls?.[0] ||
        pollPayload.data?.url ||
        pollPayload.data?.result_url;

      if (!videoUrl) {
        return {
          ok: false,
          providerMessage: `Jimeng video task finished but no video URL was returned.`,
          raw: pollResult.data
        };
      }

      return {
        ok: true,
        videoUrl,
        taskId,
        providerMessage: "Jimeng video generated successfully.",
        raw: pollResult.data
      };
    }

    if (taskStatus === "not_found" || taskStatus === "expired") {
      return {
        ok: false,
        providerMessage: `Jimeng video task status: ${taskStatus}`,
        raw: pollResult.data
      };
    }

    await sleep(pollIntervalMs);
  }

  return {
    ok: false,
    providerMessage: `Jimeng video polling timed out. Waited about ${Math.round((maxAttempts * pollIntervalMs) / 1000)}s.`,
    taskId
  };
}

async function generateJimengVideoGeneric(input: VideoGenerationInput): Promise<ProviderVideoResult> {
  const { prompt, referenceImageBase64 } = input;
  const endpoint = getEnv("JIMENG_VIDEO_ENDPOINT");
  const apiKey = getEnv("JIMENG_API_KEY");
  const model = getEnv("JIMENG_VIDEO_MODEL") || "jimeng-video-2.0";

  const requestBody = {
    model,
    prompt,
    ...(referenceImageBase64 ? { binary_data_base64: [referenceImageBase64] } : {})
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
      providerMessage: `Jimeng video request failed with HTTP ${response.status}.`,
      raw: payload
    };
  }

  const videoUrl = extractImageUrl(payload);

  if (!videoUrl) {
    return {
      ok: false,
      providerMessage: "Jimeng video response did not contain a usable video URL.",
      raw: payload
    };
  }

  return {
    ok: true,
    videoUrl,
    providerMessage: "Jimeng video generated successfully.",
    raw: payload
  };
}

async function generateSeeddanceVideo(input: VideoGenerationInput, model: string): Promise<ProviderVideoResult> {
  const { prompt, referenceImageBase64, referenceEndImageBase64, duration = 5, aspectRatio = "16:9", multimodalReferences } = input;
  const arkEndpoint = getEnv("ARK_ENDPOINT");
  const arkApiKey = getEnv("ARK_API_KEY");

  // 构建 content 数组
  const content: Array<{ type: string; text?: string; image_url?: { url: string }; video_url?: { url: string }; audio_url?: { url: string }; role?: string }> = [
    { type: "text", text: prompt }
  ];

  // Seedance 2.0 支持多模态参考
  if (model.includes("2-0") && multimodalReferences && multimodalReferences.length > 0) {
    // 使用多模态参考文件
    for (const ref of multimodalReferences) {
      if (ref.type === "image") {
        content.push({
          type: "image_url",
          image_url: { url: `data:image/jpeg;base64,${ref.base64}` },
          role: "reference_image"
        });
      } else if (ref.type === "video") {
        content.push({
          type: "video_url",
          video_url: { url: `data:video/mp4;base64,${ref.base64}` },
          role: "reference_video"
        });
      } else if (ref.type === "audio") {
        content.push({
          type: "audio_url",
          audio_url: { url: `data:audio/mpeg;base64,${ref.base64}` },
          role: "reference_audio"
        });
      }
    }
  } else {
    // Seedance 1.5 Pro 使用 first_frame/last_frame
    // Seedance 2.0 兼容模式（如果没有multimodalReferences）使用 reference_image
    const imageRole = model.includes("2-0") ? "reference_image" : "first_frame";
    const lastFrameRole = model.includes("2-0") ? "reference_image" : "last_frame";

    // 添加首帧图片
    if (referenceImageBase64) {
      content.push({
        type: "image_url",
        image_url: { url: `data:image/jpeg;base64,${referenceImageBase64}` },
        role: imageRole
      });
    }

    // 添加尾帧图片
    if (referenceEndImageBase64) {
      content.push({
        type: "image_url",
        image_url: { url: `data:image/jpeg;base64,${referenceEndImageBase64}` },
        role: lastFrameRole
      });
    }
  }

  // 根据模型和是否有首尾帧来确定duration的有效性
  // Seedance 1.5 Pro 首尾帧模式(flf2v)：duration必须是5秒
  // Seedance 2.0：支持更长的时长（最多11秒）
  let finalDuration = duration;
  if (model.includes("1-5-pro")) {
    const hasFirstAndLastFrame = referenceImageBase64 && referenceEndImageBase64;
    finalDuration = hasFirstAndLastFrame ? 5 : duration;
  }

  // 提交任务 - 使用正确的火山方舟 Content Generation API 格式
  const submitBody = {
    model,
    content,
    ratio: aspectRatio,
    duration: finalDuration,
    watermark: false,
    generate_audio: true
  };

  const submitResponse = await fetch(`${arkEndpoint}/contents/generations/tasks`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${arkApiKey}`
    },
    body: JSON.stringify(submitBody)
  });

  if (!submitResponse.ok) {
    const errorText = await submitResponse.text();
    return {
      ok: false,
      providerMessage: `Seeddance submit failed: HTTP ${submitResponse.status} - ${errorText}`,
      raw: errorText
    };
  }

  const submitData = await submitResponse.json() as {
    id?: string;
    error?: { code?: string; message?: string };
  };

  if (!submitData.id) {
    return {
      ok: false,
      providerMessage: `Seeddance submit failed: ${submitData.error?.message || "No task ID returned"}`,
      raw: submitData
    };
  }

  const taskId = submitData.id;
  const maxAttempts = Number.parseInt(getEnv("JIMENG_VIDEO_POLL_MAX_ATTEMPTS") || "60", 10);
  const pollIntervalMs = Number.parseInt(getEnv("JIMENG_VIDEO_POLL_INTERVAL_MS") || "5000", 10);

  // 轮询任务状态
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const pollResponse = await fetch(`${arkEndpoint}/contents/generations/tasks/${taskId}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${arkApiKey}`
      }
    });

    if (!pollResponse.ok) {
      return {
        ok: false,
        providerMessage: `Seeddance polling failed: HTTP ${pollResponse.status}`,
        taskId
      };
    }

    const pollData = await pollResponse.json() as {
      id: string;
      status: string;
      content?: {
        video_url?: string;
      };
      error?: {
        code?: string;
        message?: string;
      };
    };

    const status = pollData.status;

    if (status === "succeeded") {
      const videoUrl = pollData.content?.video_url;
      if (!videoUrl) {
        return {
          ok: false,
          providerMessage: "Seeddance task succeeded but no video URL returned",
          taskId,
          raw: pollData
        };
      }

      return {
        ok: true,
        videoUrl,
        taskId,
        providerMessage: "Seeddance video generated successfully.",
        raw: pollData
      };
    }

    if (status === "failed") {
      return {
        ok: false,
        providerMessage: `Seeddance task failed: ${pollData.error?.message || "Unknown error"}`,
        taskId,
        raw: pollData
      };
    }

    // 状态为 queued 或 running，继续等待
    await sleep(pollIntervalMs);
  }

  return {
    ok: false,
    providerMessage: `Seeddance polling timed out. Waited about ${Math.round((maxAttempts * pollIntervalMs) / 1000)}s.`,
    taskId
  };
}

export async function generateJimengVideo(
  prompt: string,
  referenceImageBase64?: string,
  referenceEndImageBase64?: string,
  duration?: number,
  aspectRatio?: string,
  modelOverride?: string,
  multimodalReferences?: MultimodalReference[]
): Promise<ProviderVideoResult> {
  if (!isRealMode()) {
    return {
      ok: false,
      providerMessage: "Jimeng real mode is not configured."
    };
  }

  const input: VideoGenerationInput = {
    prompt,
    referenceImageBase64,
    referenceEndImageBase64,
    duration,
    aspectRatio,
    multimodalReferences
  };

  // 优先使用前端传来的模型参数，其次使用环境变量
  const model = modelOverride || getEnv("JIMENG_VIDEO_MODEL") || "jimeng-video-2.0";

  // 根据模型选择对应的实现
  // 所有包含 "seedance" 的模型都使用火山方舟 API
  if (model.includes("seedance")) {
    if (!hasArkConfig()) {
      return {
        ok: false,
        providerMessage: "Seeddance models require ARK_API_KEY and ARK_ENDPOINT to be configured."
      };
    }
    return generateSeeddanceVideo(input, model);
  }

  // 老的即梦模型
  if (hasOfficialVisualConfig()) {
    return generateJimengVideoOfficial(input);
  }

  return generateJimengVideoGeneric(input);
}
