import express from "express";

import { register } from "../../lib/metrics.js";

const router = express.Router();

router.get("/", async (_req, res) => {
  res.set("Content-Type", register.contentType);
  res.end(await register.metrics());
});

export default router;
