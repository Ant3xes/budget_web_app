import { ImageResponse } from "next/og";

// Image OG statique et générique pour tout le site : `app/opengraph-image.tsx` à la
// racine s'applique à toute route qui n'a pas sa propre image plus spécifique
// (aucune route n'en définit une aujourd'hui — voir issue #89).
export const alt = "Budget & Comptes";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 32,
          background: "linear-gradient(135deg, #0f172a, #1e1b4b)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <div
            style={{
              display: "flex",
              width: 120,
              height: 120,
              borderRadius: 32,
              background: "linear-gradient(135deg, #6366f1, #22c55e)",
            }}
          />
          <div style={{ display: "flex", fontSize: 72, fontWeight: 700, color: "#ffffff" }}>Budget & Comptes</div>
        </div>
        <div style={{ display: "flex", fontSize: 32, color: "#a5b4fc" }}>
          Suivi de budget et de comptes bancaires personnel
        </div>
      </div>
    ),
    { ...size },
  );
}
