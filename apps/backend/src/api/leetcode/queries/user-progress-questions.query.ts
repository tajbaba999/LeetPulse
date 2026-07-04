import { gql } from "graphql-request";

export const GET_USER_PROGRESS_QUESTIONS = gql`
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
