import { ImageResponse } from "next/og";

export const size = { height: 180, width: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    <div style={{ alignItems: "center", background: "#103f33", display: "flex", height: "100%", justifyContent: "center", width: "100%" }}>
      <div style={{ border: "12px solid white", borderRadius: 22, display: "flex", height: 88, position: "relative", width: 94 }}>
        <div style={{ border: "12px solid white", borderBottomWidth: "0px", borderRadius: "30px 30px 0 0", display: "flex", height: 34, left: 22, position: "absolute", top: -43, width: 38 }} />
        <div style={{ background: "white", borderRadius: 8, display: "flex", height: 12, left: 29, position: "absolute", top: 28, width: 28 }} />
      </div>
    </div>,
    size,
  );
}
