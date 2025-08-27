// File: src/graphql/resolvers/todoResolvers.ts

import { Todo, ITodo } from "../../models/Todo";
import { Types } from "mongoose";
import { AuthContext } from "../../middleware/auth";

interface TodosArgs {
  skip?: number;
  take?: number;
}

interface AddTodoArgs {
  text: string;
}

interface TodoIdArgs {
  id: string;
}

type TodoPayload = {
  id: string;
  text: string;
  completed: boolean;
  createdAt: string;
};

export const todoResolvers = {
  Query: {
    todos: async (
      _parent: unknown,
      args: TodosArgs,
      context: AuthContext
    ): Promise<TodoPayload[]> => {
      const { userId } = context;
      if (!userId) {
        throw new Error("Authentication required");
      }

      const skip = args.skip ?? 0;
      const take = args.take ?? 10;

      try {
        // Fetch plain JS objects for type safety
        const docs = await Todo.find({
          userId: new Types.ObjectId(userId),
        })
          .skip(skip)
          .limit(take)
          .sort({ createdAt: -1 })
          .lean<ITodo[]>();

        return docs.map((d) => ({
          id: d.id.toString(),
          text: d.text,
          completed: d.completed,
          createdAt: d.createdAt.toISOString(),
        }));
      } catch (err: any) {
        console.error("Failed to fetch todos:", err);
        throw new Error("Failed to fetch todos");
      }
    },
  },

  Mutation: {
    addTodo: async (
      _parent: unknown,
      args: AddTodoArgs,
      context: AuthContext
    ): Promise<TodoPayload> => {
      const { userId } = context;
      if (!userId) {
        throw new Error("Authentication required");
      }

      try {
        const newTodo = new Todo({
          text: args.text,
          userId: new Types.ObjectId(userId),
        });
        const saved = await newTodo.save();

        return {
          id: saved.id.toString(),
          text: saved.text,
          completed: saved.completed,
          createdAt: saved.createdAt.toISOString(),
        };
      } catch (err: any) {
        console.error("Failed to add todo:", err);
        throw new Error(err.message || "Failed to add todo");
      }
    },

    toggleTodo: async (
      _parent: unknown,
      args: TodoIdArgs,
      context: AuthContext
    ): Promise<TodoPayload> => {
      const { userId } = context;
      if (!userId) {
        throw new Error("Authentication required");
      }

      try {
        const todo = await Todo.findOne({
          _id: new Types.ObjectId(args.id),
          userId: new Types.ObjectId(userId),
        });

        if (!todo) {
          throw new Error("Todo not found");
        }

        todo.completed = !todo.completed;
        const updated = await todo.save();

        return {
          id: updated.id.toString(),
          text: updated.text,
          completed: updated.completed,
          createdAt: updated.createdAt.toISOString(),
        };
      } catch (err: any) {
        console.error("Failed to toggle todo:", err);
        throw new Error(err.message || "Failed to toggle todo");
      }
    },

    deleteTodo: async (
      _parent: unknown,
      args: TodoIdArgs,
      context: AuthContext
    ): Promise<boolean> => {
      const { userId } = context;
      if (!userId) {
        throw new Error("Authentication required");
      }

      try {
        const result = await Todo.deleteOne({
          _id: new Types.ObjectId(args.id),
          userId: new Types.ObjectId(userId),
        });
        if (result.deletedCount === 0) {
          throw new Error("Todo not found");
        }
        return true;
      } catch (err: any) {
        console.error("Failed to delete todo:", err);
        throw new Error(err.message || "Failed to delete todo");
      }
    },
  },
};
