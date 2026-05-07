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
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

const app = express();
app.use(cors({ origin: FRONTEND_URL, credentials: true }));
app.use(express.json());

const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: [FRONTEND_URL, "http://localhost:3000"],
    methods: ["GET", "POST"],
    credentials: true,
  },
  transports: ["websocket", "polling"],
});

// Auth middleware
io.use(socketAuthMiddleware);

// Connection handler
io.on("connection", (socket: AuthenticatedSocket) => {
  log.success(`Client connected: ${socket.id} | User: ${socket.userId || "guest"} | Role: ${socket.role || "public"}`);

  registerNotificationEvents(io, socket);
  registerCarUpdateEvents(io, socket);
  registerChatEvents(io, socket);

  socket.on("disconnect", (reason) => {
    log.warn(`Client disconnected: ${socket.id} — ${reason}`);
  });

  socket.on("error", (err) => {
    log.error(`Socket error: ${socket.id}`, err);
  });
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    connections: io.engine.clientsCount,
    uptime: process.uptime(),
  });
});

// Internal API endpoint — backend calls this to push notifications
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

  log.success(`Internal notification pushed to user ${userId}: ${title}`);
  res.json({ success: true });
});

// Broadcast to everyone
app.post("/internal/broadcast", (req, res) => {
  const { room, event, data } = req.body;
  io.to(room || "public:feed").emit(event, data);
  res.json({ success: true });
});

httpServer.listen(PORT, () => {
  log.success(`Socket.IO server running on port ${PORT}`);
  log.info(`Accepting connections from: ${FRONTEND_URL}`);
});

export { io };
