// File: src/index.ts
import dotenv from "dotenv";
dotenv.config();

// 0. Global process‐level error handlers
process.on("unhandledRejection", reason =>
  console.error("✖ Unhandled Promise Rejection:", reason)
);
process.on("uncaughtException", error =>
  console.error("✖ Uncaught Exception:", error)
);

import express, { Request, Response, NextFunction } from "express";
import path from "path";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import csurf from "csurf";

import webRoutes from "./routes/web";
import { connectDB } from "./config/database";
import { jwtAuth } from "./middleware/auth";

import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@apollo/server/express4";
import { typeDefs } from "./graphql/schema";
import { resolvers } from "./graphql/resolvers";

// Extend Express.Request with userId
declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

const app = express();

// 1. Security & logging
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(morgan("dev"));

// 2. CORS, body parsing, cookies
const corsOrigin = process.env.CORS_ORIGIN || "http://localhost:3000";
app.use(
  cors({
    origin: corsOrigin,
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ✅ Run JWT auth globally so req.userId is set early
app.use(jwtAuth);

// Small, explicit handler to silence favicon requests in dev
app.get("/favicon.ico", (_req: Request, res: Response) => res.status(204).end());

// 3. Mount GraphQL (no CSRF)
async function mountGraphQL() {
  const server = new ApolloServer({
    typeDefs,
    resolvers,
    formatError: err => {
      console.error("🚨 GraphQL Error:", err);
      return { message: err.message };
    },
  });
  await server.start();

  app.use(
    "/graphql",
    cors({ origin: corsOrigin, credentials: true }),
    express.json(),
    expressMiddleware(server, {
      context: async ({ req }) => {
        return { userId: (req as Request).userId };
      },
    })
  );
}

// 4. CSRF protection for web routes (skip for GraphQL/static/favicon)
const csrfProtection = csurf({
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  },
});

app.use((req: Request, res: Response, next: NextFunction) => {
  const urlPath = req.originalUrl || "";
  if (
    urlPath.startsWith("/graphql") ||
    urlPath.startsWith("/public") ||
    urlPath === "/favicon.ico"
  ) {
    return next();
  }

  csrfProtection(req, res, (err?: any) => {
    if (err) return next(err);
    res.locals.csrfToken = req.csrfToken();
    next();
  });
});

// 5. Rate limiting
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: "Too many requests, please try again later.",
  })
);

// 6. Static assets & EJS views
app.use(express.static(path.join(__dirname, "../public")));
app.set("views", path.join(__dirname, "../views"));
app.set("view engine", "ejs");

// 7. Web routes
app.use(webRoutes);

// 8. CSRF error handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  if (err.code === "EBADCSRFTOKEN") {
    console.warn("⚠️ CSRF token mismatch:", err);
    return res.status(403).render("error", {
      message:
        "Form tampering detected (invalid CSRF token). Please refresh and try again.",
      stack: process.env.NODE_ENV === "development" ? err.stack : null,
    });
  }
  next(err);
});

// 9. Global Express error handler (fix: must have 4 args)
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error("❗️ Express Error:", err?.stack || err);

  const urlPath = req.originalUrl || "";
  if (urlPath.startsWith("/graphql")) {
    return res.status(500).json({
      errors: [{ message: err?.message || "Internal server error" }],
    });
  }

  // If headers already sent, delegate to Express default
  if (res.headersSent) return next(err);

  res.status(500).render("error", {
    message: err?.message || "Something went wrong",
    stack: process.env.NODE_ENV === "development" ? err?.stack : null,
  });
});

// 10. Connect DB, start servers
async function start() {
  await connectDB();
  await mountGraphQL();

  const PORT = process.env.PORT || 4000;
  app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
    console.log(`GraphQL endpoint at http://localhost:${PORT}/graphql`);
    console.log(`CORS origin: ${corsOrigin}`);
    console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
  });
}

start().catch(err => {
  console.error("Startup error:", err);
  process.exit(1);
});
