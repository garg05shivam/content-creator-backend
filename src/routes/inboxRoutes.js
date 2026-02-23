import { Router } from "express";
import protect from "../middleware/authMiddleware.js";
import {
  clearConversationForMe,
  getConversationMessages,
  getInbox,
  searchUsers,
  sendMessage,
  startConversation,
} from "../controllers/inboxController.js";

const router = Router();

router.use(protect);
router.get("/", getInbox);
router.get("/users", searchUsers);
router.post("/start", startConversation);
router.get("/:conversationId/messages", getConversationMessages);
router.post("/:conversationId/messages", sendMessage);
router.delete("/:conversationId/messages", clearConversationForMe);
router.post("/:conversationId/clear", clearConversationForMe);

export default router;
