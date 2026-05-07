import { Server } from "socket.io";
import { AuthenticatedSocket } from "../middleware/auth";
import { log } from "../utils/logger";

export const registerChatEvents = (
  io: Server,
  socket: AuthenticatedSocket
) => {
  // Join a conversation thread
  socket.on("chat:join", (threadId: string) => {
    socket.join(`thread:${threadId}`);
    log.info(`Socket ${socket.id} joined thread ${threadId}`);
  });

  socket.on("chat:leave", (threadId: string) => {
    socket.leave(`thread:${threadId}`);
  });

  // Send a message in a thread
  socket.on("chat:message", (data: {
    threadId: string;
    message: string;
    receiverId: string;
  }) => {
    if (!socket.userId) return;

    const messagePayload = {
      threadId: data.threadId,
      senderId: socket.userId,
      senderRole: socket.role,
      message: data.message,
      sentAt: new Date().toISOString(),
    };

    // Send to everyone in the thread
    io.to(`thread:${data.threadId}`).emit("chat:message:new", messagePayload);

    // Also notify the receiver directly
    io.to(`user:${data.receiverId}`).emit("chat:notification", {
      threadId: data.threadId,
      preview: data.message.slice(0, 60),
      from: socket.userId,
    });

    log.info(`Message in thread ${data.threadId} from ${socket.userId}`);
  });

  // Typing indicator
  socket.on("chat:typing", (data: { threadId: string; isTyping: boolean }) => {
    socket.to(`thread:${data.threadId}`).emit("chat:typing", {
      userId: socket.userId,
      isTyping: data.isTyping,
    });
  });
};
