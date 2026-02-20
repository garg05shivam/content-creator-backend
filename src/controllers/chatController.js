import ChatMessage from "../models/ChatMessage.js";
import User from "../models/User.js";

export const getMessages = async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const currentUser = await User.findById(req.user._id)
      .select("tokens hiddenChatMessageIds chatClearedAt")
      .lean();

    const query = {};
    if (currentUser?.chatClearedAt) {
      query.createdAt = { $gt: currentUser.chatClearedAt };
    }

    const recent = await ChatMessage.find(query)
      .populate("sender", "name email role")
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    const messages = recent.reverse();

    res.status(200).json({
      success: true,
      messages,
      remainingTokens: currentUser?.tokens ?? 0,
    });
  } catch (error) {
    console.error("Get chat messages error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch chat messages" });
  }
};

export const postMessage = async (req, res) => {
  try {
    const text = String(req.body?.text || "").trim();

    if (!text) {
      return res.status(400).json({ success: false, message: "Message text is required" });
    }

    // Deduct 1 token atomically. If user has 0, block the message.
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

    const created = await ChatMessage.create({
      text,
      sender: req.user._id,
    });

    const message = await ChatMessage.findById(created._id)
      .populate("sender", "name email role")
      .lean();

    res.status(201).json({
      success: true,
      message,
      remainingTokens: updatedUser.tokens,
    });
  } catch (error) {
    console.error("Post chat message error:", error);
    res.status(500).json({ success: false, message: "Failed to send message" });
  }
};

export const deleteAllMessages = async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user._id, {
      $set: {
        chatClearedAt: new Date(),
        hiddenChatMessageIds: [],
      },
    });

    res.status(200).json({
      success: true,
      message: "Chat cleared in your account",
    });
  } catch (error) {
    console.error("Delete all chat messages error:", error);
    res.status(500).json({ success: false, message: "Failed to delete chat messages" });
  }
};
