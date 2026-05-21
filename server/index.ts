import express, { type Request, Response, NextFunction } from "express";
import rateLimit from "express-rate-limit";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";

const app = express();
const httpServer = createServer(app);

// Trust Caddy (one proxy hop) so req.ip reflects the real client IP
app.set("trust proxy", 1);

// When deployed under a sub-path (e.g. /quantum-workflow-assistant), the
// client prepends that prefix to all API URLs. Strip it here so every route
// handler sees the canonical /api/... paths regardless of how the app is
// accessed (directly or through a reverse proxy that keeps the prefix).
const _basePath = (process.env.VITE_BASE_PATH || "").replace(/\/$/, "");
if (_basePath) {
  app.use((req, _res, next) => {
    if (req.url.startsWith(_basePath + "/")) {
      req.url = req.url.slice(_basePath.length);
    }
    next();
  });
}

// Rate limit all API routes: 120 requests per minute per IP
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please slow down." },
});
app.use("/api", apiLimiter);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

// ─── Security: block direct access to the job database and other sensitive
// server-side directories.  These files are never part of the static build
// output, but an extra explicit guard prevents accidental exposure if the
// static-serving configuration ever changes.
app.use(["/database", "/database/{*path}", "/secrets", "/secrets/{*path}"], (_req, res) => {
  res.status(403).json({ error: "Forbidden" });
});

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, unknown> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  await registerRoutes(httpServer, app);

  app.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
    const raw = err as Record<string, unknown>;
    const status = (typeof raw?.status === "number" ? raw.status :
                    typeof raw?.statusCode === "number" ? raw.statusCode : 500);
    // Sanitize the message: strip any DATABASE_URL-style connection strings and
    // API-key-like tokens so credentials never reach the client or the log.
    const rawMessage = typeof raw?.message === "string" ? raw.message : "Internal Server Error";
    const message = sanitizeErrorMessage(rawMessage);

    // Log the sanitized message only (never the raw error object which may
    // contain stack frames referencing connection strings).
    console.error(`Internal Server Error [${status}]: ${message}`);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();

/**
 * Remove sensitive patterns from error messages before logging or returning
 * them to clients:
 *   • postgres:// / postgresql:// connection strings (contain passwords)
 *   • Bearer tokens and API-key-style values (sk-..., sk-ant-...)
 */
function sanitizeErrorMessage(msg: string): string {
  return msg
    // PostgreSQL connection strings: postgres(ql)://user:password@host/db
    .replace(/postgres(?:ql)?:\/\/[^@\s]+@[^\s"')]+/gi, "postgres://<redacted>")
    // Generic password= query-params in connection strings
    .replace(/password=[^&\s"']+/gi, "password=<redacted>")
    // Anthropic / OpenAI API key patterns
    .replace(/sk-ant-[A-Za-z0-9_-]{10,}/g, "<api-key>")
    .replace(/sk-[A-Za-z0-9]{20,}/g, "<api-key>")
    // Generic Bearer tokens
    .replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, "Bearer <redacted>");
}
