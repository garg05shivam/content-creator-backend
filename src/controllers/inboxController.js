import mongoose from "mongoose";
import Conversation from "../models/Conversation.js";
import DirectMessage from "../models/DirectMessage.js";
import User from "../models/User.js";
import { getIO } from "../socket.js";

const toObjectId = (value) => new mongoose.Types.ObjectId(String(value));

const getUserClearedAt = (conversation, userId) => {
  const entries = Array.isArray(conversation?.clearedAtBy) ? conversation.clearedAtBy : [];
  const entry = entries.find((item) => String(item?.user) === String(userId));
  return entry?.at ? new Date(entry.at) : null;
};

const buildOtherParticipant = (conversation, currentUserId) => {
  const other = conversation.participants.find(
    (p) => String(p._id || p) !== String(currentUserId)
  );
  if (!other) return null;
  return {
    _id: String(other._id || other),
    name: other.name || "Unknown",
    email: other.email || "",
    role: other.role || "",
  };
};

export const searchUsers = async (req, res) => {
  try {
    const query = String(req.query.query || "").trim();
    if (!query) {
      return res.status(200).json({ success: true, users: [] });
    }

    const regex = new RegExp(query, "i");
    const users = await User.find({
      _id: { $ne: req.user._id },
      $or: [{ name: regex }, { email: regex }],
    })
      .select("name email role")
      .limit(15)
      .lean();

    res.status(200).json({ success: true, users });
  } catch (error) {
    console.error("Search users error:", error);
    res.status(500).json({ success: false, message: "Failed to search users" });
  }
};

export const startConversation = async (req, res) => {
  try {
    const targetUserId = String(req.body?.userId || "");
    if (!targetUserId) {
      return res.status(400).json({ success: false, message: "userId is required" });
    }
    if (String(req.user._id) === targetUserId) {
      return res.status(400).json({ success: false, message: "Cannot chat with yourself" });
    }

    const targetUser = await User.findById(targetUserId).select("name email role").lean();
    if (!targetUser) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    let conversation = await Conversation.findOne({
      participants: { $all: [toObjectId(req.user._id), toObjectId(targetUserId)] },
    }).populate("participants", "name email role");

    if (!conversation) {
      conversation = await Conversation.create({
        participants: [req.user._id, targetUserId],
        unreadBy: [],
      });
      conversation = await Conversation.findById(conversation._id).populate(
        "participants",
        "name email role"
      );
    }

    res.status(200).json({ success: true, conversation });
  } catch (error) {
    console.error("Start conversation error:", error);
    res.status(500).json({ success: false, message: "Failed to start conversation" });
  }
};

export const getInbox = async (req, res) => {
  try {
    const conversations = await Conversation.find({
      participants: req.user._id,
    })
      .populate("participants", "name email role")
      .sort({ updatedAt: -1 })
      .lean();

    const data = conversations.map((conv) => {
      const clearedAt = getUserClearedAt(conv, req.user._id);
      const lastMessageCreatedAt = conv?.lastMessage?.createdAt
        ? new Date(conv.lastMessage.createdAt)
        : null;
      const hideLastMessage =
        !!clearedAt && !!lastMessageCreatedAt && lastMessageCreatedAt <= clearedAt;

      return {
        _id: conv._id,
        otherUser: buildOtherParticipant(conv, req.user._id),
        lastMessage: hideLastMessage ? null : conv.lastMessage || null,
        unread: Array.isArray(conv.unreadBy)
          ? conv.unreadBy.some((id) => String(id) === String(req.user._id))
          : false,
        updatedAt: conv.updatedAt,
      };
    });

    res.status(200).json({ success: true, conversations: data });
  } catch (error) {
    console.error("Get inbox error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch inbox" });
  }
};

export const getConversationMessages = async (req, res) => {
  try {
    const conversationId = String(req.params.conversationId || "");
    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 200);

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ success: false, message: "Conversation not found" });
    }
    if (!conversation.participants.some((id) => String(id) === String(req.user._id))) {
      return res.status(403).json({ success: false, message: "Not allowed" });
    }

    const query = { conversation: conversationId };
    const clearedAt = getUserClearedAt(conversation, req.user._id);
    if (clearedAt) {
      query.createdAt = { $gt: clearedAt };
    }

    const messages = await DirectMessage.find(query)
      .populate("sender", "name email role")
      .populate("receiver", "name email role")
      .sort({ createdAt: 1 })
      .limit(limit)
      .lean();

    await Conversation.findByIdAndUpdate(conversationId, {
      $pull: { unreadBy: req.user._id },
    });

    res.status(200).json({ success: true, messages });
  } catch (error) {
    console.error("Get conversation messages error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch messages" });
  }
};

export const sendMessage = async (req, res) => {
  try {
    const conversationId = String(req.params.conversationId || "");
    const text = String(req.body?.text || "").trim();
    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
      return res.status(400).json({ success: false, message: "Invalid conversationId" });
    }
    if (!text) {
      return res.status(400).json({ success: false, message: "Message text is required" });
    }

    const conversation = await Conversation.findById(conversationId).populate(
      "participants",
      "name email role"
    );
    if (!conversation) {
      return res.status(404).json({ success: false, message: "Conversation not found" });
    }

    const participants = Array.isArray(conversation.participants)
      ? conversation.participants.filter(Boolean)
      : [];
    if (!participants.some((p) => String(p._id) === String(req.user._id))) {
      return res.status(403).json({ success: false, message: "Not allowed" });
    }

    const receiver = participants.find(
      (p) => String(p._id) !== String(req.user._id)
    );
    if (!receiver?._id) {
      return res.status(400).json({ success: false, message: "Invalid conversation" });
    }

    const updatedUser = await User.findOneAndUpdate(
      { _id: req.user._id, tokens: { $gt: 0 } },
      { $inc: { tokens: -1 } },
      { new: true, projection: { tokens: 1 } }
    );
    if (!updatedUser) {
      return res.status(402).json({
        success: false,
        message: "Out of tokens. Please purchase more to continue chatting.",
      });
    }

    const created = await DirectMessage.create({
      conversation: conversation._id,
      sender: req.user._id,
      receiver: receiver._id,
      text,
    });

    const message = await DirectMessage.findById(created._id)
      .populate("sender", "name email role")
      .populate("receiver", "name email role")
      .lean();

    await Conversation.findByIdAndUpdate(conversation._id, {
      $set: {
        lastMessage: {
          text,
          sender: req.user._id,
          createdAt: new Date(),
        },
      },
      $addToSet: { unreadBy: receiver._id },
    });

    await Conversation.findByIdAndUpdate(conversation._id, {
      $pull: { unreadBy: req.user._id },
    });

    const io = getIO();
    if (io) {
      io.to(`user:${String(receiver._id)}`).emit("inbox:new_message", {
        conversationId: String(conversation._id),
        message,
      });
      io.to(`user:${String(req.user._id)}`).emit("inbox:new_message", {
        conversationId: String(conversation._id),
        message,
      });
    }

    res.status(201).json({ success: true, message, remainingTokens: updatedUser.tokens });
  } catch (error) {
    console.error("Send inbox message error:", error);
    res.status(500).json({
      success: false,
      message: process.env.NODE_ENV === "production" ? "Failed to send message" : error.message,
    });
  }
};

export const clearConversationForMe = async (req, res) => {
  try {
    const conversationId = String(req.params.conversationId || "");
    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
      return res.status(400).json({ success: false, message: "Invalid conversationId" });
    }

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ success: false, message: "Conversation not found" });
    }
    if (!conversation.participants.some((id) => String(id) === String(req.user._id))) {
      return res.status(403).json({ success: false, message: "Not allowed" });
    }

    const now = new Date();
    const updateExisting = await Conversation.updateOne(
      { _id: conversationId, "clearedAtBy.user": req.user._id },
      {
        $set: { "clearedAtBy.$.at": now },
        $pull: { unreadBy: req.user._id },
      }
    );

    if (updateExisting.matchedCount === 0) {
      await Conversation.findByIdAndUpdate(conversationId, {
        $push: { clearedAtBy: { user: req.user._id, at: now } },
        $pull: { unreadBy: req.user._id },
      });
    }

    return res.status(200).json({
      success: true,
      message: "Conversation cleared in your account",
    });
  } catch (error) {
    console.error("Clear conversation error:", error);
    return res.status(500).json({ success: false, message: "Failed to clear conversation" });
  }
};
