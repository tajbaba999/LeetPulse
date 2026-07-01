import Express from "express";
import { Credential, LeetCode } from "leetcode-query";

// ── Shared LeetCode client (no auth) ──

const lc = new LeetCode();

// ── Authenticated client (reads from .env) ──

function getAuthClient() {
  const session = process.env.LEETCODE_SESSION;
  const csrf = process.env.LEETCODE_CSRF;

  if (!session || !csrf) {
    return null;
  }

  const credential = new Credential();
  credential.session = session;
  credential.csrf = csrf;

  return new LeetCode(credential);
}

const router = Express.Router();

// ── GET /api/v1/leetcode/progress ──
// Authenticated — fetches ALL problems the user has attempted/solved

router.get("/progress", async (_req, res) => {
  try {
    const authLc = getAuthClient();

    if (!authLc) {
      return res.status(500).json({ message: "LEETCODE_SESSION and LEETCODE_CSRF must be set in .env" });
    }

    // Fetch all problems in batches of 50
    const allQuestions: Array<{
      translatedTitle: string;
      frontendId: string;
      title: string;
      titleSlug: string;
      difficulty: string;
      lastSubmittedAt: string;
      numSubmitted: number;
      questionStatus: string;
      lastResult: string;
      topicTags: Array<{ name: string; nameTranslated: string; slug: string }>;
    }> = [];

    let skip = 0;
    const limit = 50;
    let hasMore = true;

    while (hasMore) {
      const batch = await authLc.user_progress_questions({ skip, limit });

      allQuestions.push(...batch.questions);

      skip += limit;
      hasMore = batch.questions.length === limit;
    }

    console.log(JSON.stringify({ totalNum: allQuestions.length, questions: allQuestions }, null, 2));

    res.status(200).json({ totalNum: allQuestions.length, questions: allQuestions });
  }
  catch (ex) {
    console.error("userProgressQuestionList error:", ex);
    res.status(500).json({ message: "Failed to fetch question progress" });
  }
});

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

export default router;
