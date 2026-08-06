import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdfjs-dist's fake-worker fallback (used server-side, since Node has no
  // real Worker) dynamically imports pdf.worker.mjs relative to its own
  // module location. Bundling it moves that file into a .next chunk path
  // where the relative import breaks, so it's left external and resolved
  // via normal node_modules resolution instead.
  serverExternalPackages: ["pdfjs-dist"],
};

export default nextConfig;
