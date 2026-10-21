import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "مهامي — مدير المهام الذكي",
    short_name: "مهامي",
    description: "مدير مهام ذكي بالعربية مع مزامنة فورية ودعم العمل بدون إنترنت",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    dir: "rtl",
    lang: "ar",
    background_color: "#f2f2f7",
    theme_color: "#007aff",
    categories: ["productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "مهمة جديدة", url: "/?new=1", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "اليوم", url: "/?tab=today" },
    ],
  };
}
