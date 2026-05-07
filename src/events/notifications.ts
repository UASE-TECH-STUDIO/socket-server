import { Server } from "socket.io";
import { AuthenticatedSocket } from "../middleware/auth";
import { log } from "../utils/logger";

export const registerNotificationEvents = (
  io: Server,
  socket: AuthenticatedSocket
) => {
  // Join personal room so we can target specific users
  if (socket.userId) {
    socket.join(`user:${socket.userId}`);
    log.info(`User ${socket.userId} joined personal room`);
  }

  // Join role room
  if (socket.role) {
    socket.join(`role:${socket.role}`);
  }

  // Mark notification as read
  socket.on("notification:read", (notificationId: string) => {
    log.info(`Notification read: ${notificationId} by ${socket.userId}`);
    // The frontend handles optimistic updates
    // Backend REST endpoint does the actual DB update
    socket.emit("notification:read:ack", { notificationId });
  });

  // Mark all notifications as read
  socket.on("notification:read:all", () => {
    socket.emit("notification:read:all:ack", { success: true });
  });
};

// Helper: send notification to a specific user
export const sendNotificationToUser = (
  io: Server,
  userId: string,
  notification: {
    type: string;
    title: string;
    message: string;
    data?: any;
  }
) => {
  io.to(`user:${userId}`).emit("notification:new", {
    ...notification,
    createdAt: new Date().toISOString(),
    isRead: false,
  });
  log.success(`Notification sent to user ${userId}: ${notification.title}`);
};

// Helper: broadcast to all admins
export const broadcastToAdmins = (
  io: Server,
  event: string,
  data: any
) => {
  io.to("role:SYSTEM_ADMIN").emit(event, data);
};

// Helper: broadcast to all dealer staff
export const broadcastToDealer = (
  io: Server,
  dealerUserId: string,
  event: string,
  data: any
) => {
  io.to(`user:${dealerUserId}`).emit(event, data);
};
