import Express from "express";

import activity from "./activity.js";
import getProfile from "./get-profile.js";
import history from "./history.js";
import initialSync from "./initial-sync.js";
import questions from "./questions.js";
import sync from "./sync.js";
import topicMatrix from "./topic-matrix.js";

const router = Express.Router();

router.use(initialSync);
router.use(sync);
router.use(getProfile);
router.use(history);
router.use(activity);
router.use(questions);
router.use(topicMatrix);

export default router;
