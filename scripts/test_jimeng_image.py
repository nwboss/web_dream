import datetime
import hashlib
import hmac
import json
import os
import sys
import time
from pathlib import Path

import requests


METHOD = "POST"
HOST = "visual.volcengineapi.com"
REGION = "cn-north-1"
ENDPOINT = "https://visual.volcengineapi.com"
SERVICE = "cv"


def load_env_file():
    env_path = Path(__file__).resolve().parent.parent / ".env"
    if not env_path.exists():
        return

    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue

        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip()

        if (value.startswith('"') and value.endswith('"')) or (value.startswith("'") and value.endswith("'")):
            value = value[1:-1]

        os.environ.setdefault(key, value)


def sign(key, msg):
    return hmac.new(key, msg.encode("utf-8"), hashlib.sha256).digest()


def get_signature_key(key, date_stamp, region_name, service_name):
    k_date = sign(key.encode("utf-8"), date_stamp)
    k_region = sign(k_date, region_name)
    k_service = sign(k_region, service_name)
    k_signing = sign(k_service, "request")
    return k_signing


def format_query(parameters):
    items = []
    for key in sorted(parameters):
        items.append(f"{key}={parameters[key]}")
    return "&".join(items)


def sign_v4_headers(access_key, secret_key, service, req_query, req_body, session_token=None):
    if not access_key or not secret_key:
        raise RuntimeError("Missing JIMENG_ACCESS_KEY or JIMENG_SECRET_KEY")

    t = datetime.datetime.utcnow()
    current_date = t.strftime("%Y%m%dT%H%M%SZ")
    datestamp = t.strftime("%Y%m%d")
    canonical_uri = "/"
    canonical_querystring = req_query
    signed_headers = "content-type;host;x-content-sha256;x-date"
    if session_token:
        signed_headers += ";x-security-token"

    payload_hash = hashlib.sha256(req_body.encode("utf-8")).hexdigest()
    content_type = "application/json"
    canonical_headers = (
        "content-type:" + content_type + "\n"
        + "host:" + HOST + "\n"
        + "x-content-sha256:" + payload_hash + "\n"
        + "x-date:" + current_date + "\n"
    )

    if session_token:
        canonical_headers += "x-security-token:" + session_token + "\n"

    canonical_request = (
        METHOD + "\n"
        + canonical_uri + "\n"
        + canonical_querystring + "\n"
        + canonical_headers + "\n"
        + signed_headers + "\n"
        + payload_hash
    )

    algorithm = "HMAC-SHA256"
    credential_scope = datestamp + "/" + REGION + "/" + service + "/" + "request"
    string_to_sign = (
        algorithm + "\n"
        + current_date + "\n"
        + credential_scope + "\n"
        + hashlib.sha256(canonical_request.encode("utf-8")).hexdigest()
    )

    signing_key = get_signature_key(secret_key, datestamp, REGION, service)
    signature = hmac.new(signing_key, string_to_sign.encode("utf-8"), hashlib.sha256).hexdigest()

    authorization_header = (
        algorithm + " "
        + "Credential=" + access_key + "/" + credential_scope + ", "
        + "SignedHeaders=" + signed_headers + ", "
        + "Signature=" + signature
    )

    headers = {
        "X-Date": current_date,
        "Authorization": authorization_header,
        "X-Content-Sha256": payload_hash,
        "Content-Type": content_type,
    }
    if session_token:
        headers["X-Security-Token"] = session_token

    return headers


def call_visual_api(action, body, access_key, secret_key, session_token=None):
    query_params = {
        "Action": action,
        "Version": "2022-08-31",
    }
    formatted_query = format_query(query_params)
    formatted_body = json.dumps(body, ensure_ascii=False)
    headers = sign_v4_headers(access_key, secret_key, SERVICE, formatted_query, formatted_body, session_token=session_token)
    request_url = ENDPOINT + "?" + formatted_query

    response = requests.post(request_url, headers=headers, data=formatted_body.encode("utf-8"), timeout=60)
    try:
      payload = response.json()
    except Exception:
      payload = response.text

    return {
        "status_code": response.status_code,
        "headers": headers,
        "body": body,
        "response": payload,
    }


def main():
    load_env_file()

    access_key = os.getenv("JIMENG_ACCESS_KEY", "").strip()
    secret_key = os.getenv("JIMENG_SECRET_KEY", "").strip()
    session_token = os.getenv("JIMENG_SESSION_TOKEN", "").strip() or None
    prompt = sys.argv[1] if len(sys.argv) > 1 else "一个黑发少年站在暴雨夜天台边缘，城市霓虹，电影感国漫"
    width = int(sys.argv[2]) if len(sys.argv) > 2 else 1328
    height = int(sys.argv[3]) if len(sys.argv) > 3 else 1328
    do_poll = "--poll" in sys.argv
    poll_attempts = int(os.getenv("JIMENG_POLL_MAX_ATTEMPTS", "10"))
    poll_interval_ms = int(os.getenv("JIMENG_POLL_INTERVAL_MS", "1500"))

    print("== Jimeng Python Test ==")
    print("endpoint:", ENDPOINT)
    print("region:", REGION)
    print("service:", SERVICE)
    print("has access key:", bool(access_key))
    print("has secret key:", bool(secret_key))
    print("has session token:", bool(session_token))
    print("prompt:", prompt)
    print("width x height:", f"{width} x {height}")
    print("")

    submit_body = {
        "req_key": "jimeng_t2i_v31",
        "prompt": prompt,
        "use_pre_llm": True,
        "seed": -1,
        "width": width,
        "height": height,
    }

    submit_result = call_visual_api(
        "CVSync2AsyncSubmitTask",
        submit_body,
        access_key=access_key,
        secret_key=secret_key,
        session_token=session_token,
    )

    print("== Submit Result ==")
    print("http status:", submit_result["status_code"])
    print("signed headers:", submit_result["headers"])
    print("request body:", submit_result["body"])
    print("response:", json.dumps(submit_result["response"], ensure_ascii=False, indent=2) if isinstance(submit_result["response"], dict) else submit_result["response"])
    print("")

    response_payload = submit_result["response"] if isinstance(submit_result["response"], dict) else {}
    task_id = response_payload.get("data", {}).get("task_id")
    if not do_poll or submit_result["status_code"] != 200 or response_payload.get("code") != 10000 or not task_id:
        return

    for attempt in range(1, poll_attempts + 1):
        poll_body = {
            "req_key": "jimeng_t2i_v31",
            "task_id": task_id,
            "req_json": json.dumps(
                {
                    "return_url": True,
                    "logo_info": {
                        "add_logo": False,
                        "position": 0,
                        "language": 0,
                        "opacity": 1,
                    },
                },
                ensure_ascii=False,
            ),
        }

        poll_result = call_visual_api(
            "CVSync2AsyncGetResult",
            poll_body,
            access_key=access_key,
            secret_key=secret_key,
            session_token=session_token,
        )
        print(f"== Poll Attempt {attempt} ==")
        print(json.dumps(poll_result["response"], ensure_ascii=False, indent=2) if isinstance(poll_result["response"], dict) else poll_result["response"])
        print("")

        poll_payload = poll_result["response"] if isinstance(poll_result["response"], dict) else {}
        status = poll_payload.get("data", {}).get("status")
        if status in {"done", "not_found", "expired"}:
            break

        time.sleep(poll_interval_ms / 1000)


if __name__ == "__main__":
    main()
