import Express from "express";

import prisma from "../../db.js";
import { codingProfileSchema } from "../../validators/profile.validator.js";

const router = Express.Router();

router.post("/", async (req, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const allprofiles = codingProfileSchema.safeParse(req.body);
    if (allprofiles.success) {
      const { leetcode, codeforces, codechef, hackerrank, geeksforgeeks } = allprofiles.data;

      const existingProfile = await prisma.codingProfiles.findFirst({
        where: {
          userId: user.userId,
        },
      });

      if (existingProfile) {
        return res.status(400).json({ message: "Coding profiles already exist" });
      }

      await prisma.codingProfiles.create({
        data: {
          userId: user.userId,
          leetcode,
          codeforces,
          codechef,
          hackerrank,
          geeksforgeeks,
        },
      });

      res.status(200).json({ message: "Successfully added coding profiles" });
    }
    else {
      res.status(422).json({ message: "Invalid coding profiles" });
    }
  }
  catch (ex) {
    console.error("Something went wrong while adding coding profiles", ex);
    res.status(500).json({ message: "Server Error!" });
  }
});

router.put("/", async (req, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const allprofiles = codingProfileSchema.safeParse(req.body);
    if (allprofiles.success) {
      const { leetcode, codeforces, codechef, hackerrank, geeksforgeeks } = allprofiles.data;

      await prisma.codingProfiles.update({
        where: { userId: user.userId },
        data: { leetcode, codeforces, codechef, hackerrank, geeksforgeeks },
      });

      res.status(200).json({ message: "Successfully updated coding profiles" });
    }
    else {
      res.status(422).json({ message: "Invalid coding profiles" });
    }
  }
  catch (ex) {
    console.error("Something went wrong while updating the coding profiles", ex);
    res.status(500).json({ message: "Server Error!" });
  }
});

export default router;
