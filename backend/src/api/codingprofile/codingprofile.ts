import Express from "express";
import { z } from "zod/v4";
import { codingProfileSchema } from "../../validators/profile.validator.js";
const router = Express.Router();


router.post("/", async (req, res) => {
    try {
        const allprofiles = codingProfileSchema.safeParse(req.body);
        if (allprofiles.success) {
            const { leetcode, codeforces, codechef, hackerrank, geeksforgeeks } = allprofiles.data;
            console.log("Leetcode", leetcode);
            console.log("Codeforces", codeforces);
            console.log("Codechef", codechef);
            console.log("Hackerrank", hackerrank);
            console.log("Geeksforgeeks", geeksforgeeks);

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



export default router;
