import express, { type Express } from "express";
import fs from "fs";
import path from "path";

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  const basePath = (process.env.VITE_BASE_PATH || "").replace(/\/$/, "");

  // When deployed under a sub-path (e.g. /quantum-workflow-assistant), Vite
  // bakes that prefix into all asset URLs. We must mount the static middleware
  // at that same prefix so the browser can load them.
  if (basePath) {
    app.use(basePath, express.static(distPath));
  }
  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist
  app.use("/{*path}", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
