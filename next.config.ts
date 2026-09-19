import type { NextConfig } from "next";

const backend = (process.env.BACKEND_URL ?? "http://localhost:4000").replace(/\/+$/, "");

const nextConfig: NextConfig = {
  // The browser calls /api/* on this origin and Next forwards it to the backend. The session cookie
  // is therefore first-party, which matters because browsers increasingly block third-party cookies.
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${backend}/api/:path*` }];
  },
};

export default nextConfig;
