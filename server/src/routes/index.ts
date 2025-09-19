import { Router } from "express";import userRoutes from "./user.routes";
import chatRoutes from "./chat.routes";
import memoryRoutes from "./memory.routes";
import activityRoutes from "./activity.routes";
import actionLogRoutes from "./action-log.routes";

const router = Router();

router.use("/users", userRoutes);
router.use("/chat", chatRoutes);
router.use("/memories", memoryRoutes);
router.use("/activities", activityRoutes);
router.use("/action-logs", actionLogRoutes);

export default router;
