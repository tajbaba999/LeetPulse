import express from "express";

import type MessageResponse from "../interfaces/message-response.js";

import { authenticateToken } from "../middlewares.js";
import RefreshToken from "./auth/refresh-token.js";
import Singin from "./auth/signin.js";
import Signup from "./auth/singup.js";
import CodingProfile from "./codingprofile/codingprofile.js";
import { authenticateSSE, syncStreamHandler } from "./codingprofile/sync.stream.js";
import LeetCode from "./leetcode/leetcode.js";
import Metrics from "./metrics/metrics.js";
import Profile from "./profile.js";
import Rag from "./rag/rag.js";

const router = express.Router();

router.get<object, MessageResponse>("/", (req, res) => {
  res.json({
    message: "API - 👋🌎🌍🌏",
  });
});

router.use("/metrics", Metrics);
router.use("/signup", Signup);
router.use("/signin", Singin);
router.use("/refresh-token", RefreshToken);
router.use("/leetcode", LeetCode);

// SSE stream route — registered before global auth so it can also accept ?token= query param
// (native browser EventSource cannot send Authorization headers)
router.get("/codingprofile/sync/stream", authenticateSSE, syncStreamHandler);

// Everything below this line requires a valid access token.
router.use(authenticateToken);

router.use("/profile", Profile);
router.use("/codingprofile", CodingProfile);
router.use("/rag", Rag);

export default router;
