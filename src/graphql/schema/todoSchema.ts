import { gql } from "graphql-tag";


export const todoTypeDefs = gql`
  type Todo {
    id: ID!
    text: String!
    completed: Boolean!
    createdAt: String!
  }

  type Query {
    todos(skip: Int!, take: Int!): [Todo!]!
  }

  type Mutation {
    addTodo(text: String!): Todo!
    toggleTodo(id: ID!): Todo!
    deleteTodo(id: ID!): Boolean!
  }
`;