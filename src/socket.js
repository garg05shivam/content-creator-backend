import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import Conversation from "./models/Conversation.js";

let io = null;

export const initSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || "http://localhost:5173",
      credentials: true,
    },
  });

  io.use((socket, next) => {
    try {
      const raw = socket.handshake.auth?.token || "";
      const token = raw.startsWith("Bearer ") ? raw.split(" ")[1] : raw;
      if (!token) {
        return next(new Error("Unauthorized socket connection"));
      }
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = String(decoded.id);
      return next();
    } catch {
      return next(new Error("Unauthorized socket connection"));
    }
  });

  io.on("connection", (socket) => {
    socket.join(`user:${socket.userId}`);

    socket.on("inbox:typing", async (payload = {}) => {
      try {
        const conversationId = String(payload.conversationId || "");
        const isTyping = Boolean(payload.isTyping);

        if (!mongoose.Types.ObjectId.isValid(conversationId)) return;

        const conversation = await Conversation.findById(conversationId)
          .select("participants")
          .lean();
        if (!conversation) return;

        const senderId = String(socket.userId);
        const participantIds = Array.isArray(conversation.participants)
          ? conversation.participants.map((id) => String(id))
          : [];

        if (!participantIds.includes(senderId)) return;

        for (const participantId of participantIds) {
          if (participantId === senderId) continue;
          io.to(`user:${participantId}`).emit("inbox:typing", {
            conversationId,
            senderId,
            isTyping,
          });
        }
      } catch {
        // Ignore typing event errors to keep socket stable.
      }
    });
  });

  return io;
};

export const getIO = () => io;
