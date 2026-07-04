import express from "express";

import prisma from "../db.js";

const router = express.Router();

router.get("/", async (req, res) => {
  if (!req.user) {
    req.log.warn("Unauthenticated request to GET /me");
    return res.status(401).json({ error: "Unauthorized" });
  }

  const log = req.log.child({ userId: req.user.userId });

  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      log.warn("Authenticated user not found in DB");
      return res.status(404).json({ error: "User not found" });
    }

    log.info("Fetched user profile");
    res.status(200).json(user);
  }
  catch (error) {
    log.error({ err: error }, "Failed to fetch user profile");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
