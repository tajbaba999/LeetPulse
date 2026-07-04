import { gql } from "graphql-request";

export const GET_QUESTION_PROGRESS = gql`
  query userProfileUserQuestionProgressV2($username: String!) {
    userProfileUserQuestionProgressV2(userSlug: $username) {
      numAcceptedQuestions {
        count
        difficulty
      }
      numFailedQuestions {
        count
        difficulty
      }
      numUntouchedQuestions {
        count
        difficulty
      }
      userSessionBeatsPercentage {
        difficulty
        percentage
      }
      totalQuestionBeatsPercentage
    }
  }
`;
