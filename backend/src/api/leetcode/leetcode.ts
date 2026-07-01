import Express from "express";
import { GraphQLClient, gql } from "graphql-request";

const LEETCODE_GLOBAL = "https://leetcode.com/graphql";
const LEETCODE_CN = "https://leetcode.cn/graphql";

// ── Query 1: getUserProfile (public, no auth) ──

const GET_USER_PROFILE = gql`
  query getUserProfile($username: String!) {
    matchedUser(username: $username) {
      activeBadge {
        displayName
        icon
      }
    }
  }
`;

// ── Query 2: userProgressQuestionList (auth required, leetcode.cn) ──

const GET_USER_PROGRESS = gql`
  query userProgressQuestionList($filters: UserProgressQuestionListInput) {
    userProgressQuestionList(filters: $filters) {
      totalNum
      questions {
        translatedTitle
        frontendId
        title
        titleSlug
        difficulty
        lastSubmittedAt
        numSubmitted
        questionStatus
        lastResult
        topicTags {
          name
          nameTranslated
          slug
        }
      }
    }
  }
`;

const globalClient = new GraphQLClient(LEETCODE_GLOBAL, {
  headers: {
    "Content-Type": "application/json",
    "Referer": "https://leetcode.com",
  },
});

const router = Express.Router();

// ── GET /api/v1/leetcode/:username ──
// Public — fetches user badge profile from leetcode.com

router.get("/:username", async (req, res) => {
  try {
    const { username } = req.params;

    const data = await globalClient.request<{ matchedUser: { activeBadge: { displayName: string; icon: string } | null } }>(
      GET_USER_PROFILE,
      { username },
    );

    console.log(JSON.stringify(data, null, 2));

    res.status(200).json(data);
  }
  catch (ex) {
    console.error("getUserProfile error:", ex);
    res.status(500).json({ message: "Failed to fetch LeetCode profile" });
  }
});

// ── POST /api/v1/leetcode/progress ──
// Authenticated — fetches question progress list from leetcode.cn
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

    const cnClient = new GraphQLClient(LEETCODE_CN, {
      headers: {
        "Content-Type": "application/json",
        "Referer": "https://leetcode.cn",
        "Origin": "https://leetcode.cn",
        "Cookie": `csrftoken=${csrf}; LEETCODE_SESSION=${session};`,
        "x-csrftoken": csrf,
      },
    });

    const data = await cnClient.request<{
      userProgressQuestionList: {
        totalNum: number;
        questions: Array<{
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
        }>;
      };
    }>(GET_USER_PROGRESS, {
      filters: { skip, limit },
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
