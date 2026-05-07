import { Socket } from "socket.io";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "usty08146550674";

export interface AuthenticatedSocket extends Socket {
  userId?: string;
  role?: string;
  email?: string;
  dealerId?: string;
}

export const socketAuthMiddleware = (
  socket: AuthenticatedSocket,
  next: (err?: Error) => void
) => {
  try {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.replace("Bearer ", "");

    if (!token) {
      // Allow unauthenticated for public feed
      return next();
    }

    const payload = jwt.verify(token, JWT_SECRET) as any;
    socket.userId = payload.sub;
    socket.role = payload.role;
    socket.email = payload.email;

    next();
  } catch (err) {
    next(new Error("Invalid token"));
  }
};
