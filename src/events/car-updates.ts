import { Server } from "socket.io";
import { AuthenticatedSocket } from "../middleware/auth";
import { log } from "../utils/logger";

export const registerCarUpdateEvents = (
  io: Server,
  socket: AuthenticatedSocket
) => {
  // Subscribe to public car feed updates
  socket.on("feed:subscribe", () => {
    socket.join("public:feed");
    log.info(`Socket ${socket.id} subscribed to public feed`);
  });

  socket.on("feed:unsubscribe", () => {
    socket.leave("public:feed");
  });
};

// Broadcast new car to public feed
export const broadcastNewCar = (io: Server, car: any) => {
  io.to("public:feed").emit("feed:new:car", {
    carId: car.carId,
    brand: car.brand,
    model: car.model,
    year: car.year,
    sellingPrice: car.sellingPrice,
    images: car.images,
    status: car.status,
    city: car.city,
    createdAt: new Date().toISOString(),
  });
};

// Broadcast car sold
export const broadcastCarSold = (io: Server, carId: string) => {
  io.to("public:feed").emit("feed:car:sold", { carId });
};
