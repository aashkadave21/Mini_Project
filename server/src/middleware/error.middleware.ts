import type { Request, Response, NextFunction } from "express";

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const reqId = (req.headers["x-request-id"] as string) || `REQ-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  res.setHeader("X-Request-ID", reqId);
  (req as any).id = reqId;
  next();
}

export function errorHandler(err: any, req: Request, res: Response, _next: NextFunction): void {
  const status = err.status || err.statusCode || 500;
  const requestId = (req as any).id || "unknown";

  console.error(`[Error] [${requestId}] ${req.method} ${req.originalUrl}:`, err);

  res.status(status).json({
    success: false,
    requestId,
    error: err.name || "InternalServerError",
    message: err.message || "An unexpected error occurred during operation.",
    details: process.env.NODE_ENV === "development" ? err.details || err.stack : undefined,
    timestamp: new Date().toISOString(),
  });
}
