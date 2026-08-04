import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#e040a0",
          borderRadius: 7,
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <rect x="3" y="13" width="4" height="8" rx="1" fill="white" />
          <rect x="10" y="8" width="4" height="13" rx="1" fill="white" />
          <rect x="17" y="3" width="4" height="18" rx="1" fill="white" />
        </svg>
      </div>
    ),
    { ...size },
  );
}
