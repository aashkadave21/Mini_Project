import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { apiRouter } from "./routes/api.router.js";
import { db } from "./db/db.js";
import { seedDatabase } from "./db/seed.js";
import { requestIdMiddleware, errorHandler } from "./middleware/error.middleware.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;

// Middlewares
app.use(
  cors({
    origin: true,
    credentials: true,
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Request-ID"],
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(requestIdMiddleware);

// Structured request logging
app.use((req, res, next) => {
  const start = performance.now();
  res.on("finish", () => {
    const duration = (performance.now() - start).toFixed(1);
    if (!req.originalUrl.includes("/events")) {
      console.log(`[HTTP] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${duration}ms)`);
    }
  });
  next();
});

// API Routes prefix
app.use("/api/v1", apiRouter);

// Centralized Error Handling
app.use(errorHandler);

// Server startup and database bootstrap
async function startServer() {
  try {
    const dbStatus = await db.init();
    console.log(`[Database] Initialized engine: ${dbStatus.engine} (${dbStatus.status})`);

    // Seed demonstration dataset if needed
    await seedDatabase(false);

    const server = app.listen(PORT, () => {
      console.log(`================================================================`);
      console.log(`  SDREP Disaster Management API Backend Engine Running`);
      console.log(`  Port:      http://localhost:${PORT}`);
      console.log(`  API Base:  http://localhost:${PORT}/api/v1`);
      console.log(`  Health:    http://localhost:${PORT}/api/v1/health`);
      console.log(`  Realtime:  http://localhost:${PORT}/api/v1/events`);
      console.log(`================================================================`);
    });

    server.on("error", (err: any) => {
      if (err.code === "EADDRINUSE") {
        console.log(`[Notice] Port ${PORT} is already actively serving SDREP requests.`);
      } else {
        console.error(`[Server Error]`, err);
      }
    });

    // Graceful OS shutdown handling
    const shutdown = () => {
      console.log("\n[Shutdown] Closing SDREP server and flushing database state...");
      db.saveToFile();
      server.close(() => {
        console.log("[Shutdown] Server closed cleanly.");
        process.exit(0);
      });
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  } catch (error) {
    console.error("[Fatal] Failed to bootstrap SDREP backend:", error);
    process.exit(1);
  }
}

startServer();

export { app };
