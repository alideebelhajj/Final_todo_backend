import { Schema, model, Document, Types } from 'mongoose';

export interface ITodo extends Document {
  text: string;
  completed: boolean;
  createdAt: Date;
  userId: Types.ObjectId;
}

const todoSchema = new Schema({
  text: { type: String, required: true },
  completed: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true }
});

export const Todo = model<ITodo>('Todo', todoSchema);