// src/graphql/resolvers/userResolvers.ts

import { IUser, User } from "../../models/User";
import jwt from "jsonwebtoken";
import { GraphQLError } from "graphql";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";

interface RegisterArgs {
  username: string;
  password: string;
}

interface LoginArgs {
  username: string;
  password: string;
}

export const userResolvers = {
  Mutation: {
    register: async (
      _parent: unknown,
      args: RegisterArgs
    ): Promise<{ id: string; username: string }> => {
      const { username, password } = args;

      if (await User.findOne({ username })) {
        throw new GraphQLError("Username already exists");
      }

      const user = new User({ username, password });
      await user.save();   // pre-save hook hashes

      return {
        id: user.id.toString(),
        username: user.username,
      };
    },

    login: async (
      _parent: unknown,
      args: LoginArgs
    ): Promise<string> => {
      const { username, password } = args;
      const user = (await User.findOne({ username })) as IUser | null;

      if (!user) {
        throw new GraphQLError("User not found");
      }

      const valid = await user.comparePassword(password);
      if (!valid) {
        throw new GraphQLError("Invalid password");
      }

      return jwt.sign({ userId: user.id.toString() }, JWT_SECRET, {
        expiresIn: "7d",
      });
    },
  },
};
