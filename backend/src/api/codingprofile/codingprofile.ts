import Express from "express";
import { codingProfileSchema } from "../../validators/profile.validator.js";
import prisma from "../../db.js";
const router = Express.Router();


router.post("/", async (req, res) => {
    try {
        const user = req.user;
        if (!user) {
            return res.status(401).json({ "message": "Unauthorized" });
        }
        const allprofiles = codingProfileSchema.safeParse(req.body);
        if (allprofiles.success) {
            const { leetcode, codeforces, codechef, hackerrank, geeksforgeeks } = allprofiles.data;

            const existingProfile = await prisma.codingProfiles.findUnique({
                where: {
                    userId: user.userId
                }
            });

            if (existingProfile) {
                return res.status(400).json({ "message": "Coding profiles already exist" });
            }

            await prisma.codingProfiles.create({
                data: {
                    userId: user.userId,
                    leetcode,
                    codeforces,
                    codechef,
                    hackerrank,
                    geeksforgeeks
                }
            });

            res.status(200).json({ "message": "Successfully added coding profiles" });
        }
        else {
            res.status(422).json({ "message": "Invalid coding profiles" });
        }
    } catch (ex) {
        console.error("Something went wrong while adding coding profiles", ex);
        res.status(500).json({ "message": "Server Error!" })
    }
});


router.put("/", async (req, res) => {
    try {
        const user = req.user;
        if (!user) {
            return res.status(401).json({ "message": "Unauthorized" });
        }

        const parsed = codingProfileSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(422).json({ "message": "Invalid coding profiles" });
        }

        // Only keep fields that were actually sent (not undefined)
        const fieldsToUpdate = Object.fromEntries(
            Object.entries(parsed.data).filter(([_, v]) => v !== undefined)
        );

        if (Object.keys(fieldsToUpdate).length === 0) {
            return res.status(400).json({ "message": "No fields provided to update" });
        }

        const existingProfile = await prisma.codingProfiles.findUnique({
            where: { userId: user.userId }
        });

        if (!existingProfile) {
            return res.status(404).json({ "message": "Coding profiles not found. Create them first." });
        }

        await prisma.codingProfiles.update({
            where: { userId: user.userId },
            data: fieldsToUpdate
        });

        res.status(200).json({ "message": "Successfully updated coding profiles" });

    } catch (ex) {
        console.error("Something went wrong while updating the coding profiles", ex);
        res.status(500).json({ "message": "Server Error!" });
    }
});

router.get("/", async (req, res) => {
    try {
        const user = req.user;
        if (!user) {
            return res.status(401).json({ "message": "Unauthorized" });
        }

        const profile = await prisma.codingProfiles.findUnique({
            where: { userId: user.userId }
        });

        if (!profile) {
            return res.status(404).json({ "message": "Coding profiles not found. Create them first." });
        }

        res.status(200).json(profile);

    } catch (ex) {
        console.error("Something went wrong while fetching the coding profiles", ex);
        return res.status(500).json({ "message": "Server Error!" });
    }
});

router.delete("/", async (req, res) => {
    try {
        const user = req.user;
        if (!user) {
            return res.status(401).json({ "message": "Unauthorized" });
        }

        const profile = await prisma.codingProfiles.findUnique({
            where: { userId: user.userId }
        });

        if (!profile) {
            return res.status(404).json({ "message": "Coding profiles not found. Create them first." });
        }

        await prisma.codingProfiles.delete({
            where: { userId: user.userId }
        });

        res.status(200).json({ "message": "Successfully deleted coding profiles" });

    } catch (ex) {
        console.error("Something went wrong while deleting the coding profiles", ex);
        return res.status(500).json({ "message": "Server Error!" });
    }
});

export default router;
