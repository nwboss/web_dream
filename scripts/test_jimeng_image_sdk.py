import json
import os
import sys
from pathlib import Path


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


def map_size(aspect_ratio: str):
    if aspect_ratio == "16:9":
        return 1664, 936
    if aspect_ratio == "9:16":
        return 936, 1664
    return 1328, 1328


def main():
    load_env_file()

    try:
        from volcengine.visual.VisualService import VisualService
    except Exception as error:
        print("Failed to import volcengine SDK.")
        print("Install it first with: pip install volcengine")
        print(f"Import error: {error}")
        sys.exit(1)

    access_key = os.getenv("JIMENG_ACCESS_KEY", "").strip()
    secret_key = os.getenv("JIMENG_SECRET_KEY", "").strip()
    prompt = sys.argv[1] if len(sys.argv) > 1 else "一个黑发少年站在暴雨夜天台边缘，城市霓虹，电影感国漫"
    aspect_ratio = sys.argv[2] if len(sys.argv) > 2 else "1:1"
    width, height = map_size(aspect_ratio)

    print("== Jimeng Python SDK Test ==")
    print("has access key:", bool(access_key))
    print("has secret key:", bool(secret_key))
    print("aspect ratio:", aspect_ratio)
    print("width x height:", f"{width} x {height}")
    print("prompt:", prompt)
    print("")

    visual_service = VisualService()
    visual_service.set_ak(access_key)
    visual_service.set_sk(secret_key)

    form = {
        "req_key": "jimeng_t2i_v31",
        "prompt": prompt,
        "use_pre_llm": True,
        "seed": -1,
        "width": width,
        "height": height,
    }

    print("request body:", json.dumps(form, ensure_ascii=False))

    try:
        response = visual_service.cv_process(form)
    except Exception as error:
        print("SDK request failed:")
        print(error)
        sys.exit(1)

    print("response:")
    if isinstance(response, (dict, list)):
        print(json.dumps(response, ensure_ascii=False, indent=2))
    else:
        print(response)


if __name__ == "__main__":
    main()
