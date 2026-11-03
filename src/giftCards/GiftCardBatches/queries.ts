import { gql } from "@apollo/client";

export const giftCardBatches = gql`
  query GiftCardBatches($search: String) {
    giftCardTags(first: 100, filter: { search: $search }) {
      edges {
        node {
          id
          name
          stats {
            count
            issuedAmount
            balanceAmount
          }
        }
      }
    }
  }
`;

export const giftCardBatchSummary = gql`
  query GiftCardBatchSummary($tag: String!) {
    giftCardTags(first: 20, filter: { search: $tag }) {
      edges {
        node {
          id
          name
          stats {
            count
            issuedAmount
            balanceAmount
            activeBalanceAmount
            expiredBalanceAmount
          }
        }
      }
    }
    giftCards(first: 1, filter: { tags: [$tag] }) {
      edges {
        node {
          id
          code
          created
          expiryDate
          initialBalance {
            ...Money
          }
        }
      }
    }
  }
`;

export const giftCardBatchCodes = gql`
  query GiftCardBatchCodes($tag: String!, $after: String) {
    giftCards(first: 100, after: $after, filter: { tags: [$tag] }) {
      edges {
        node {
          code
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;
