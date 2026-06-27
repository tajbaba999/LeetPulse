import Express from "express";
import { codingProfileSchema, type CodingProfileInput } from "../../validators/profile.validator.js";
import prisma from "../../db.js";
import syncQueue from "../../queues/sync.queue.js";

// Platforms we actively sync (hackerrank excluded — no sync support yet)
const platforms: (keyof CodingProfileInput)[] = ["leetcode", "geeksforgeeks", "codechef", "codeforces"];

const router = Express.Router();

router.post("/", async (req, res) => {
    try {
        const user = req.user;
        if (!user) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const log = req.log.child({ userId: user.userId });
        const allprofiles = codingProfileSchema.safeParse(req.body);

        if (!allprofiles.success) {
            log.warn("Coding profile creation request failed validation");
            return res.status(422).json({ message: "Invalid coding profiles" });
        }

        const { leetcode, codeforces, codechef, hackerrank, geeksforgeeks } = allprofiles.data;

        const existingProfile = await prisma.codingProfiles.findUnique({
            where: { userId: user.userId },
        });

        if (existingProfile) {
            log.warn("Coding profiles already exist for user");
            return res.status(400).json({ message: "Coding profiles already exist" });
        }

        await prisma.codingProfiles.create({
            data: { userId: user.userId, leetcode, codeforces, codechef, hackerrank, geeksforgeeks },
        });

        // Queue sync jobs for each platform that has a username provided
        for (const platform of platforms) {
            const username = allprofiles.data[platform];
            if (username) {
                await syncQueue.add(`sync-${platform}`, {
                    userId: user.userId,
                    platform,
                    username,
                });
            }
        }

        log.info("Coding profiles created successfully");
        res.status(200).json({ message: "Successfully added coding profiles" });
    }
    catch (ex) {
        req.log.error({ err: ex }, "Failed to create coding profiles");
        res.status(500).json({ message: "Server Error!" });
    }
});

router.put("/", async (req, res) => {
    try {
        const user = req.user;
        if (!user) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const log = req.log.child({ userId: user.userId });
        const parsed = codingProfileSchema.safeParse(req.body);

        if (!parsed.success) {
            log.warn("Coding profile update request failed validation");
            return res.status(422).json({ message: "Invalid coding profiles" });
        }

        const fieldsToUpdate = Object.fromEntries(
            Object.entries(parsed.data).filter(([_, v]) => v !== undefined),
        );

        if (Object.keys(fieldsToUpdate).length === 0) {
            log.warn("Coding profile update attempted with no fields");
            return res.status(400).json({ message: "No fields provided to update" });
        }

        const existingProfile = await prisma.codingProfiles.findUnique({
            where: { userId: user.userId },
        });

        if (!existingProfile) {
            log.warn("Coding profile update attempted but no profile exists");
            return res.status(404).json({ message: "Coding profiles not found. Create them first." });
        }

        await prisma.codingProfiles.update({
            where: { userId: user.userId },
            data: fieldsToUpdate,
        });

        log.info({ updatedFields: Object.keys(fieldsToUpdate) }, "Coding profiles updated successfully");
        res.status(200).json({ message: "Successfully updated coding profiles" });
    }
    catch (ex) {
        req.log.error({ err: ex }, "Failed to update coding profiles");
        res.status(500).json({ message: "Server Error!" });
    }
});

router.get("/", async (req, res) => {
    try {
        const user = req.user;
        if (!user) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const log = req.log.child({ userId: user.userId });

        const profile = await prisma.codingProfiles.findUnique({
            where: { userId: user.userId },
        });

        if (!profile) {
            log.warn("Coding profiles not found for user");
            return res.status(404).json({ message: "Coding profiles not found. Create them first." });
        }

        log.info("Coding profiles fetched successfully");
        res.status(200).json(profile);
    }
    catch (ex) {
        req.log.error({ err: ex }, "Failed to fetch coding profiles");
        return res.status(500).json({ message: "Server Error!" });
    }
});

router.delete("/", async (req, res) => {
    try {
        const user = req.user;
        if (!user) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const log = req.log.child({ userId: user.userId });

        const profile = await prisma.codingProfiles.findUnique({
            where: { userId: user.userId },
        });

        if (!profile) {
            log.warn("Coding profile deletion attempted but no profile exists");
            return res.status(404).json({ message: "Coding profiles not found. Create them first." });
        }

        await prisma.codingProfiles.delete({
            where: { userId: user.userId },
        });

        log.info("Coding profiles deleted successfully");
        res.status(200).json({ message: "Successfully deleted coding profiles" });
    }
    catch (ex) {
        req.log.error({ err: ex }, "Failed to delete coding profiles");
        return res.status(500).json({ message: "Server Error!" });
    }
});

export default router;
