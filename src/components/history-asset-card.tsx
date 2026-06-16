"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type { Asset } from "@/lib/project-store";

type HistoryAssetCardProps = {
  asset: Asset;
};

export function HistoryAssetCard({ asset }: HistoryAssetCardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  async function handleRestore() {
    startTransition(async () => {
      setError("");
      const res = await fetch("/api/history/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetId: asset.id })
      });
      const data = (await res.json()) as { ok: boolean; kind?: "image" | "video"; message?: string; missingReferences?: boolean };

      if (!res.ok || !data.ok) {
        setError(data.message || "恢复失败");
        return;
      }

      const target = data.kind === "image" ? "/studio/images" : "/studio/videos";
      if (data.missingReferences) {
        const separator = target.includes("?") ? "&" : "?";
        router.push(`${target}${separator}missingReferences=1`);
      } else {
        router.push(target);
      }
    });
  }

  return (
    <div
      className="result-card"
      style={{
        padding: "10px",
        borderRadius: "12px",
        border: "1px solid var(--line)",
        background: "rgba(255, 255, 255, 0.03)",
        display: "flex",
        flexDirection: "column",
        gap: "8px"
      }}
    >
      <div style={{ position: "relative" }}>
        {asset.kind === "video" ? (
          <video
            className="result-preview"
            src={asset.previewUrl}
            style={{
              width: "100%",
              aspectRatio: "1 / 1",
              objectFit: "cover",
              borderRadius: "8px"
            }}
          />
        ) : (
          <img
            className="result-preview"
            src={asset.previewUrl}
            alt={asset.title}
            style={{
              width: "100%",
              aspectRatio: "1 / 1",
              objectFit: "cover",
              borderRadius: "8px"
            }}
          />
        )}
        <button
          type="button"
          disabled={isPending}
          onClick={handleRestore}
          style={{
            position: "absolute",
            top: "6px",
            right: "6px",
            background: "rgba(0,0,0,0.75)",
            color: "white",
            border: "none",
            borderRadius: "6px",
            padding: "4px 8px",
            fontSize: "12px",
            cursor: "pointer"
          }}
        >
          {isPending ? "..." : "修改重跑"}
        </button>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
        <span style={{ fontSize: "14px" }}>
          {asset.kind === "video" ? "🎬" : "🎨"}
        </span>
        <strong style={{ fontSize: "13px" }}>{asset.title}</strong>
      </div>
      <p className="muted" style={{ margin: 0, fontSize: "12px" }}>
        {new Date(asset.createdAt).toLocaleString("zh-CN", {
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit"
        })}
      </p>
      {error && <p style={{ margin: 0, fontSize: "12px", color: "#ff9aa9" }}>{error}</p>}
    </div>
  );
}
