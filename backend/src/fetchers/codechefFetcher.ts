import axios from "axios";
import * as cheerio from "cheerio";

import type { CodechefProfile } from "../types/coding-profiles.js";

export async function fetchCodechefProfile(username: string): Promise<CodechefProfile> {
  const url = `https://www.codechef.com/users/${username}`;

  const response = await axios.get(url, {
    timeout: 10000,
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    },
  });

  const $ = cheerio.load(response.data);

  const name = $("h2.m-username--link").text().trim();
  if (!name) {
    throw new Error(`CodeChef user "${username}" not found`);
  }

  const rating = $("div.rating-number").text().trim();
  const globalRank = $("div.rating-ranks > ul > li").eq(0).find("a > strong").text().trim();
  const countryRank = $("div.rating-ranks > ul > li").eq(1).find("a > strong").text().trim();

  return {
    username,
    name,
    rating: rating || "N/A",
    globalRank: globalRank || "N/A",
    countryRank: countryRank || "N/A",
  };
}
