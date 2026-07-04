import { gql } from "graphql-request";

export const GET_SKILL_STATS = gql`
  query skillStats($username: String!) {
    matchedUser(username: $username) {
      tagProblemCounts {
        advanced {
          tagName
          tagSlug
          problemsSolved
        }
        intermediate {
          tagName
          tagSlug
          problemsSolved
        }
        fundamental {
          tagName
          tagSlug
          problemsSolved
        }
      }
    }
  }
`;
