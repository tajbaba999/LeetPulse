import { gql } from "graphql-request";

export const GET_LANGUAGE_STATS = gql`
  query languageStats($username: String!) {
    matchedUser(username: $username) {
      languageProblemCount {
        languageName
        problemsSolved
      }
    }
  }
`;
