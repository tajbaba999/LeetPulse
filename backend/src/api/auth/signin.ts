import express from "express";
import bcrypt from "bcrypt";
import type { SinginRequest, SigninResponse } from "../../interfaces/signin.js";
import { signinSchema } from "../../validators/signin.validator.js";
import { z } from "zod/v4";
import prisma from "../../db.js";
import { generateAccessToken, generateRefreshToken } from "../../utils/tokens.js";

const router = express.Router();


router.post<SinginRequest, SigninResponse>("/", async (req, res) => {
    try {

        const result = signinSchema.safeParse(req.body);
        if (!result.success) {
            res.status(422).json({
                error: z.prettifyError(result.error),
            });
            return;
        }
        const { email, password } = result.data;

        //Check if user exists
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            return res.status(404).json({ error: "User not found" })
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ error: "Invalid password" });
        }


        //genarete access token(15 min) + refresh token( 7 days)
        const payload = { userId: user.id, email: user.email };
        const accessToken = generateAccessToken(payload);
        const refreshToken = generateRefreshToken(payload);

        res.status(200).json({ "accessToken": accessToken, "refreshToken": refreshToken });
    } catch (error) {
        console.error("Error loging in", error);
        return res.status(500).json({ error: "Something went wrong" })
    }
});


export default router;