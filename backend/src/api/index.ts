import express from "express";

import type MessageResponse from "../interfaces/message-response.js";

import { authenticateToken } from "../middlewares.js";
import Signup from "./auth/singup.js"
import Singin from "./auth/signin.js"
import Me from "./me.js";


const router = express.Router();

router.get<object, MessageResponse>("/", (req, res) => {
  res.json({
    message: "API - 👋🌎🌍🌏",
  });
});

router.use("/signup", Signup);
router.use("/signin", Singin)

// Everything below this line requires a valid  access token.
router.use(authenticateToken);

router.use("/me", Me);

export default router;


