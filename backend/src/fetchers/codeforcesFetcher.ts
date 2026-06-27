import axios from "axios";

import type { CodeforcesProfile } from "../types/coding-profiles.js";

const CF_API = "https://codeforces.com/api";

type CFUserInfo = {
  handle: string;
  rating: number;
  rank: string;
  maxRating: number;
  maxRank: string;
  contribution: number;
};

type CFStatusResponse = {
  status: string;
  result: Array<{
    problem: { contestId: number; index: string; name: string };
  }>;
};

export async function fetchCodeforcesProfile(username: string): Promise<CodeforcesProfile> {
  const userResp = await axios.get(`${CF_API}/user.info`, {
    params: { handles: username },
    timeout: 10000,
  });

  if (userResp.data.status !== "OK" || !userResp.data.result?.length) {
    throw new Error(`Codeforces user "${username}" not found`);
  }

  const user: CFUserInfo = userResp.data.result[0];

  const statusResp = await axios.get<CFStatusResponse>(`${CF_API}/user.status`, {
    params: { handle: username },
    timeout: 15000,
  });

  const solvedProblems = new Set<string>();
  if (statusResp.data.status === "OK") {
    for (const sub of statusResp.data.result) {
      if (sub.problem) {
        solvedProblems.add(`${sub.problem.contestId}-${sub.problem.index}`);
      }
    }
  }

  return {
    username: user.handle,
    rating: user.rating,
    rank: user.rank,
    maxRating: user.maxRating,
    maxRank: user.maxRank,
    contribution: user.contribution,
    solvedCount: solvedProblems.size,
  };
}
