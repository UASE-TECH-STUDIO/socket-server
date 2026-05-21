import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import dotenv from "dotenv";
import cors from "cors";
import { socketAuthMiddleware, AuthenticatedSocket } from "./middleware/auth";
import { registerNotificationEvents } from "./events/notifications";
import { registerCarUpdateEvents } from "./events/car-updates";
import { registerChatEvents } from "./events/chat";
import { log } from "./utils/logger";

dotenv.config();

const PORT = parseInt(process.env.PORT || "3001");

// Accept multiple frontend origins
const ALLOWED_ORIGINS: (string | RegExp)[] = [
  "http://localhost:3000",
  "http://localhost:3001",
  "https://carstrims-app.vercel.app",
  /\.vercel\.app$/,
  /\.onrender\.com$/,
];

if (process.env.FRONTEND_URL) {
  ALLOWED_ORIGINS.push(process.env.FRONTEND_URL);
}
if (process.env.ADDITIONAL_ORIGINS) {
  process.env.ADDITIONAL_ORIGINS.split(",").forEach(o => ALLOWED_ORIGINS.push(o.trim()));
}

const app = express();

// CORS - allow all origins for health/ping, restrict for API
app.use((req, res, next) => {
  // Allow ping endpoints from anywhere (cron jobs, UptimeRobot etc.)
  if (req.path === "/" || req.path === "/health" || req.path === "/ping") {
    res.header("Access-Control-Allow-Origin", "*");
    return next();
  }
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (server-to-server, curl)
      if (!origin) return callback(null, true);
      const allowed = ALLOWED_ORIGINS.some(o =>
        typeof o === "string" ? o === origin : o.test(origin)
      );
      callback(null, allowed);
    },
    credentials: true,
  })(req, res, next);
});

app.use(express.json());

const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      const allowed = ALLOWED_ORIGINS.some(o =>
        typeof o === "string" ? o === origin : o.test(origin)
      );
      callback(null, allowed ? origin : false);
    },
    methods: ["GET", "POST"],
    credentials: true,
  },
  transports: ["websocket", "polling"],
  pingTimeout: 60000,
  pingInterval: 25000,
});

// Auth middleware
io.use(socketAuthMiddleware);

// Connection handler
io.on("connection", (socket: AuthenticatedSocket) => {
  log.success(`Client connected: ${socket.id} | User: ${socket.userId || "guest"} | Role: ${socket.role || "public"}`);

  // Join user-specific room for notifications
  if (socket.userId) {
    socket.join(`user:${socket.userId}`);
  }
  // Join public feed room
  socket.join("public:feed");

  registerNotificationEvents(io, socket);
  registerCarUpdateEvents(io, socket);
  registerChatEvents(io, socket);

  socket.on("disconnect", (reason) => {
    log.warn(`Client disconnected: ${socket.id} -- ${reason}`);
  });

  socket.on("error", (err) => {
    log.error(`Socket error: ${socket.id}`, err);
  });
});

// --- HTTP ROUTES ------------------------------------------------------------

// ROOT ping -- cron jobs / UptimeRobot often ping /
app.get("/", (_req, res) => {
  res.status(200).json({
    service: "CARSTRIMS Socket Server",
    status: "ok",
    uptime: Math.floor(process.uptime()),
    connections: io.engine.clientsCount,
    time: new Date().toISOString(),
  });
});

// /ping -- explicit ping endpoint for cron services
app.get("/ping", (_req, res) => {
  res.status(200).send("pong");
});

// /health -- detailed health check
app.get("/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    service: "carstrims-socket",
    connections: io.engine.clientsCount,
    uptime: Math.floor(process.uptime()),
    memory: process.memoryUsage(),
    time: new Date().toISOString(),
  });
});

// Internal API -- backend calls this to push notifications to users
app.post("/internal/notify", (req, res) => {
  const { userId, type, title, message, data } = req.body;

  if (!userId || !title) {
    return res.status(400).json({ error: "userId and title required" });
  }

  io.to(`user:${userId}`).emit("notification:new", {
    type,
    title,
    message,
    data,
    isRead: false,
    createdAt: new Date().toISOString(),
  });

  log.success(`Notification pushed to user:${userId} -- ${title}`);
  res.json({ success: true });
});

// Broadcast to a room
app.post("/internal/broadcast", (req, res) => {
  const { room, event, data } = req.body;
  io.to(room || "public:feed").emit(event, data);
  log.info(`Broadcast to room "${room || "public:feed"}" event "${event}"`);
  res.json({ success: true });
});

// --- START -------------------------------------------------------------------

httpServer.listen(PORT, () => {
  log.success(`Socket.IO server running on port ${PORT}`);
  log.info(`Allowed origins: ${ALLOWED_ORIGINS.map(o => o.toString()).join(", ")}`);
});

export { io };