import { Router } from "express";
import protect from "../middleware/authMiddleware.js";
import {
  deleteAllMessages,
  getMessages,
  postMessage,
} from "../controllers/chatController.js";

const router = Router();

router.use(protect);
router.get("/messages", getMessages);
router.post("/messages", postMessage);
router.delete("/messages", deleteAllMessages);
router.post("/delete-my-messages", deleteAllMessages);
router.delete("/delete-my-messages", deleteAllMessages);

export default router;
