import express from "express";

import type MessageResponse from "../interfaces/message-response.js";

import { authenticateToken } from "../middlewares.js";
import Singin from "./auth/signin.js";
import Signup from "./auth/singup.js";
import CodingProfile from "./codingprofile/codingprofile.js";
import Profile from "./profile.js";

const router = express.Router();

router.get<object, MessageResponse>("/", (req, res) => {
  res.json({
    message: "API - 👋🌎🌍🌏",
  });
});

router.use("/signup", Signup);
router.use("/signin", Singin);

// Everything below this line requires a valid  access token.
router.use(authenticateToken);

router.use("/profile", Profile);
router.use("/codingprofile", CodingProfile);

export default router;
