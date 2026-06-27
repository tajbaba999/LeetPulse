import axios from "axios";
import * as cheerio from "cheerio";
import type { GfgProfile } from "../types/coding-profiles.js";

export async function fetchGfgProfile(username: string): Promise<GfgProfile> {
  const url = `https://auth.geeksforgeeks.org/user/${username}/profile`;

  const response = await axios.get(url, {
    timeout: 10000,
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    },
  });

  const $ = cheerio.load(response.data);

  const name = $(".name").text().trim();
  if (!name) {
    throw new Error(`GFG user "${username}" not found`);
  }

  const codingScore = $(".score_card_value").eq(0).text().trim();
  const problemsSolved = $(".score_card_value").eq(1).text().trim();

  return {
    username,
    name,
    codingScore: codingScore || "0",
    problemsSolved: problemsSolved || "0",
  };
}
