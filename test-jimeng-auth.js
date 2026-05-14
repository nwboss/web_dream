const crypto = require("crypto");

// 从环境变量读取
const accessKey = process.env.JIMENG_ACCESS_KEY || "AKLTNWRiOGE2ZDQzYmI4NDhkY2E1OWI2NTkyMjQ3YjlmNmQ";
const secretKey = process.env.JIMENG_SECRET_KEY || "TUdVek9HUmhOekV3TW1SaE5EZGxabUl3TjJZM01qWmpaR000WkRWaU56QQ==";

console.log("Testing Jimeng API Authentication...\n");
console.log("Access Key:", accessKey.substring(0, 10) + "...");
console.log("Secret Key:", secretKey.substring(0, 20) + "...\n");

function sha256Hex(value) {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

function hmac(key, value) {
  return crypto.createHmac("sha256", key).update(value, "utf8").digest();
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

function getSigningKey(secretKey, date, region, service) {
  const kDate = hmac(secretKey, date);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  return hmac(kService, "request");
}

function buildCanonicalQuery(params) {
  return Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");
}

async function testImageGeneration() {
  const endpoint = "https://visual.volcengineapi.com";
  const host = "visual.volcengineapi.com";
  const region = "cn-north-1";
  const service = "cv";
  const version = "2022-08-31";
  const contentType = "application/json";

  const body = {
    req_key: "jimeng_t2i_v31",
    prompt: "一只可爱的小猫",
    use_pre_llm: true,
    seed: -1,
    width: 1328,
    height: 1328
  };

  const payload = JSON.stringify(body);
  const params = {
    Action: "CVSync2AsyncSubmitTask",
    Version: version
  };

  const { dateTime, shortDate } = getDateParts();
  const canonicalQuery = buildCanonicalQuery(params);
  const payloadHash = sha256Hex(payload);
  const signedHeaders = "content-type;host;x-content-sha256;x-date";

  const canonicalHeaders =
    `content-type:${contentType}\n` +
    `host:${host}\n` +
    `x-content-sha256:${payloadHash}\n` +
    `x-date:${dateTime}\n`;

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

  const signature = crypto.createHmac("sha256", getSigningKey(secretKey, shortDate, region, service))
    .update(stringToSign, "utf8")
    .digest("hex");

  const headers = {
    "Content-Type": contentType,
    "X-Date": dateTime,
    "X-Content-Sha256": payloadHash,
    "Authorization": `HMAC-SHA256 Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`
  };

  console.log("=== Request Details ===");
  console.log("URL:", `${endpoint}?${canonicalQuery}`);
  console.log("Headers:", JSON.stringify(headers, null, 2));
  console.log("Body:", JSON.stringify(body, null, 2));
  console.log("\n=== Sending Request ===\n");

  try {
    const response = await fetch(`${endpoint}?${canonicalQuery}`, {
      method: "POST",
      headers,
      body: payload
    });

    const rawText = await response.text();
    let data;
    try {
      data = JSON.parse(rawText);
    } catch {
      data = rawText;
    }

    console.log("Status:", response.status);
    console.log("Response:", JSON.stringify(data, null, 2));

    if (response.status === 401) {
      console.error("\n❌ Authentication Failed!");
      console.error("Possible issues:");
      console.error("1. ACCESS_KEY or SECRET_KEY is incorrect");
      console.error("2. Keys have expired or been revoked");
      console.error("3. Keys don't have permission for this API");
    } else if (response.status === 200 && data.code === 10000) {
      console.log("\n✅ Authentication Successful!");
      console.log("Task ID:", data.data?.task_id);
    } else {
      console.log("\n⚠️  Request succeeded but may have other issues");
    }

    return data;
  } catch (error) {
    console.error("\n❌ Error:", error.message);
    throw error;
  }
}

// 运行测试
testImageGeneration().catch(console.error);
