import { ImageResponse } from "next/og";

export const dynamic = "force-static";
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 32,
          height: 32,
          background: "#080808",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg
          width="22"
          height="14"
          viewBox="0 0 28 18"
          fill="none"
        >
          <rect x="5" y="1" width="2" height="16" rx="1" fill="#e8e8e8"/>
          <rect x="1" y="1" width="10" height="2" rx="1" fill="#e8e8e8"/>
          <rect x="18" y="1" width="2" height="16" rx="1" fill="#e8e8e8"/>
          <rect x="18" y="1" width="8" height="2" rx="1" fill="#e8e8e8"/>
          <rect x="14" y="9" width="12" height="2" rx="1" fill="#e8e8e8"/>
        </svg>
      </div>
    ),
    { ...size }
  );
}
