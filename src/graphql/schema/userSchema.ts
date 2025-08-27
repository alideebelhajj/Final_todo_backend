import { gql } from "graphql-tag";


export const userTypeDefs = gql`
  type User {
    id: ID!
    username: String!
  }

  type Mutation {
    register(username: String!, password: String!): User!
    login(username: String!, password: String!): String!
  }
`;