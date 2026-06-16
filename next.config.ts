import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Court photography is served from Supabase Storage once real assets land.
    // Placeholders during development come from images.unsplash.com.
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "*.supabase.co" },
    ],
  },
};

export default nextConfig;
