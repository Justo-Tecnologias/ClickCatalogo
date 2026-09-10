import { ImageResponse } from "next/og";

export const size = { height: 32, width: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    <div style={{ alignItems: "center", background: "#103f33", display: "flex", height: "100%", justifyContent: "center", width: "100%" }}>
      <div style={{ border: "2px solid white", borderRadius: 4, display: "flex", height: 16, position: "relative", width: 17 }}>
        <div style={{ border: "2px solid white", borderBottomWidth: "0px", borderRadius: "5px 5px 0 0", display: "flex", height: 6, left: 4, position: "absolute", top: -7, width: 7 }} />
        <div style={{ background: "white", borderRadius: 2, display: "flex", height: 2, left: 5, position: "absolute", top: 5, width: 5 }} />
      </div>
    </div>,
    size,
  );
}
