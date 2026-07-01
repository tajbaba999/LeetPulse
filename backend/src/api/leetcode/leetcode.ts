import Express from "express";
import { Credential, LeetCode } from "leetcode-query";

// ── Shared LeetCode client (no auth) ──

const lc = new LeetCode();

const router = Express.Router();

// ── GET /api/v1/leetcode/:username ──
// Public — fetches user badge profile from leetcode.com

router.get("/:username", async (req, res) => {
  try {
    const { username } = req.params;

    const data = await lc.user(username);

    console.log(JSON.stringify(data, null, 2));

    res.status(200).json(data);
  }
  catch (ex) {
    console.error("getUserProfile error:", ex);
    res.status(500).json({ message: "Failed to fetch LeetCode profile" });
  }
});

// ── POST /api/v1/leetcode/progress ──
// Authenticated — fetches question progress list
// Body: { username, session, csrf, skip?, limit? }

router.post("/progress", async (req, res) => {
  try {
    const { username, session, csrf, skip = 0, limit = 50 } = req.body as {
      username: string;
      session: string;
      csrf: string;
      skip?: number;
      limit?: number;
    };

    if (!username || !session || !csrf) {
      return res.status(400).json({ message: "username, session, and csrf are required" });
    }

    const credential = new Credential();
    credential.session = session;
    credential.csrf = csrf;

    const authLc = new LeetCode(credential);

    const data = await authLc.user_progress_questions({
      skip,
      limit,
    });

    console.log(JSON.stringify(data, null, 2));

    res.status(200).json(data);
  }
  catch (ex) {
    console.error("userProgressQuestionList error:", ex);
    res.status(500).json({ message: "Failed to fetch question progress" });
  }
});

export default router;
