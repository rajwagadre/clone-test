import { Router } from "express";
import * as channelController from "../controllers/channel";
import { authenticate } from "../middlewares/auth";

const router = Router();

// Channel routes
router.post("/", authenticate, channelController.createChannel);
router.get("/", authenticate, channelController.getChannels);
router.get("/:channelId", authenticate, channelController.getChannelById);
router.put("/:channelId", authenticate, channelController.updateChannel);
router.delete("/:channelId", authenticate, channelController.deleteChannel);

// Channel members routes
router.post("/:channelId/members", authenticate, channelController.addChannelMember);
router.delete("/:channelId/members/:userId", authenticate, channelController.removeChannelMember);

// Channel messages routes
router.get("/:channelId/messages", authenticate, channelController.getChannelMessages);

export default router;