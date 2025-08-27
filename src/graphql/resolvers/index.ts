import { userResolvers } from './userResolvers';
import { todoResolvers } from './todoResolvers';

export const resolvers = {
  Query: {
    ...todoResolvers.Query
  },
  Mutation: {
    ...userResolvers.Mutation,
    ...todoResolvers.Mutation
  }
};