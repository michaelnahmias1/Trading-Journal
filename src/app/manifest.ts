import type { MetadataRoute } from "next";

// Web App Manifest — makes the journal installable to the home screen with a
// native, standalone feel (no browser chrome) and the app icon.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "יומן מסחר",
    short_name: "יומן מסחר",
    description: "יומן מסחר אישי — מראה לתוצאות שלך, נטו ואחרי מס.",
    lang: "he",
    dir: "rtl",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0b0f17",
    theme_color: "#0b0f17",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
