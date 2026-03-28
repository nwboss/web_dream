import fs from "fs";
import path from "path";
import process from "process";
import { createHash, createHmac } from "crypto";

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const content = fs.readFileSync(filePath, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const index = trimmed.indexOf("=");
    if (index === -1) {
      continue;
    }

    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();

    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function getEnv(name, fallback = "") {
  return process.env[name]?.trim() || fallback;
}

function buildQuery(params) {
  return Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");
}

function sha256Hex(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function hmac(key, value) {
  return createHmac("sha256", key).update(value, "utf8").digest();
}

function getDateParts() {
  const iso = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  const dateTime = iso.replace(/[:-]/g, "").replace(/\.\d{3}/g, "");
  return {
    dateTime,
    shortDate: dateTime.slice(0, 8)
  };
}

function getSigningKey(secretKey, date, region, service) {
  const kDate = hmac(secretKey, date);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  return hmac(kService, "request");
}

async function callVisualApi(action, body) {
  const endpoint = "https://visual.volcengineapi.com";
  const host = "visual.volcengineapi.com";
  const region = "cn-north-1";
  const service = "cv";
  const version = "2022-08-31";
  const payload = JSON.stringify(body);
  const params = {
    Action: action,
    Version: version
  };
  const queryString = buildQuery(params);
  const dateParts = getDateParts();
  const payloadHash = sha256Hex(payload);
  const sessionToken = getEnv("JIMENG_SESSION_TOKEN") || "";
  const signedHeaders = sessionToken
    ? "content-type;host;x-content-sha256;x-date;x-security-token"
    : "content-type;host;x-content-sha256;x-date";
  const canonicalHeaders =
    `content-type:application/json\n` +
    `host:${host}\n` +
    `x-content-sha256:${payloadHash}\n` +
    `x-date:${dateParts.dateTime}\n` +
    (sessionToken ? `x-security-token:${sessionToken}\n` : "");
  const canonicalRequest =
    "POST\n/\n" +
    `${queryString}\n` +
    `${canonicalHeaders}\n` +
    `${signedHeaders}\n` +
    `${payloadHash}`;
  const credentialScope = `${dateParts.shortDate}/${region}/${service}/request`;
  const signature = createHmac("sha256", getSigningKey(getEnv("JIMENG_SECRET_KEY"), dateParts.shortDate, region, service))
    .update(
      "HMAC-SHA256\n" +
        `${dateParts.dateTime}\n` +
        `${credentialScope}\n` +
        `${sha256Hex(canonicalRequest)}`,
      "utf8"
    )
    .digest("hex");
  const headers = {
    "Content-Type": "application/json",
    "X-Date": dateParts.dateTime,
    "X-Content-Sha256": payloadHash,
    ...(sessionToken ? { "X-Security-Token": sessionToken } : {}),
    Authorization: `HMAC-SHA256 Credential=${getEnv("JIMENG_ACCESS_KEY")}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`
  };

  const response = await fetch(`${endpoint}?${queryString}`, {
    method: "POST",
    headers,
    body: payload
  });

  const text = await response.text();
  let json = null;

  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }

  return {
    status: response.status,
    ok: response.ok,
    headers,
    body,
    data: json
  };
}

async function main() {
  loadEnvFile(path.join(process.cwd(), ".env"));

  const prompt = process.argv[2] || "一个黑发少年站在暴雨夜天台边缘，城市霓虹，电影感国漫";
  const width = Number.parseInt(process.argv[3] || "1328", 10);
  const height = Number.parseInt(process.argv[4] || "1328", 10);
  const shouldPoll = process.argv.includes("--poll");
  const pollMaxAttempts = Number.parseInt(getEnv("JIMENG_POLL_MAX_ATTEMPTS", "10"), 10);
  const pollIntervalMs = Number.parseInt(getEnv("JIMENG_POLL_INTERVAL_MS", "1500"), 10);

  console.log("== Jimeng Image Test ==");
  console.log("endpoint:", "https://visual.volcengineapi.com");
  console.log("region:", "cn-north-1");
  console.log("service:", "cv");
  console.log("has access key:", Boolean(getEnv("JIMENG_ACCESS_KEY")));
  console.log("has secret key:", Boolean(getEnv("JIMENG_SECRET_KEY")));
  console.log("has session token:", Boolean(getEnv("JIMENG_SESSION_TOKEN")));
  console.log("prompt:", prompt);
  console.log("width x height:", `${width} x ${height}`);
  console.log("");

  const submitBody = {
    req_key: "jimeng_t2i_v31",
    prompt,
    use_pre_llm: true,
    seed: -1,
    width,
    height
  };

  const submitResult = await callVisualApi("CVSync2AsyncSubmitTask", submitBody);

  console.log("== Submit Result ==");
  console.log("http status:", submitResult.status);
  console.log("signed headers:", submitResult.headers);
  console.log("request body:", submitResult.body);
  console.log("response:", JSON.stringify(submitResult.data, null, 2));
  console.log("");

  const taskId = submitResult.data?.data?.task_id;
  if (!shouldPoll || !submitResult.ok || submitResult.data?.code !== 10000 || !taskId) {
    return;
  }

  console.log("== Polling Task ==");
  for (let attempt = 1; attempt <= pollMaxAttempts; attempt += 1) {
    const pollBody = {
      req_key: "jimeng_t2i_v31",
      task_id: taskId,
      req_json: JSON.stringify({
        return_url: true,
        logo_info: {
          add_logo: false,
          position: 0,
          language: 0,
          opacity: 1
        }
      })
    };

    const pollResult = await callVisualApi("CVSync2AsyncGetResult", pollBody);
    console.log(`attempt ${attempt}:`, JSON.stringify(pollResult.data, null, 2));

    const status = pollResult.data?.data?.status;
    if (status === "done" || status === "not_found" || status === "expired") {
      break;
    }

    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }
}

main().catch((error) => {
  console.error("Jimeng test failed:");
  console.error(error);
  process.exit(1);
});
