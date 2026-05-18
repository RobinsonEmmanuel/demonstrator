import type { NextConfig } from "next";
import path from "path";
import { createRequire } from "module";

const require = createRequire(path.join(__dirname, "package.json"));

const nextConfig: NextConfig = {
  /** Monorepo : un package-lock à la racine + celui du workspace ; évite l'avertissement Next sur la racine « tracing » */
  outputFileTracingRoot: path.join(__dirname, ".."),
  /** SDK OpenAI côté Node uniquement — évite des erreurs Webpack du type « __webpack_modules__ is not a function ». */
  serverExternalPackages: ["openai"],
  experimental: {
    /** Réduit les imports Heroicons et limite les chunks problématiques. */
    optimizePackageImports: ["@heroicons/react"],
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  webpack: (config, { isServer }) => {
    /** Alias uniquement côté client : deux copies de React cassent le hook dispatcher (useContext null). */
    if (!isServer) {
      try {
        const reactRoot = path.dirname(require.resolve("react/package.json"));
        const reactDomRoot = path.dirname(require.resolve("react-dom/package.json"));
        config.resolve.alias = {
          ...config.resolve.alias,
          react: reactRoot,
          "react-dom": reactDomRoot,
        };
      } catch {
        /* résolution par défaut */
      }
    }
    return config;
  },
};

export default nextConfig;
