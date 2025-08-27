// File: src/routes/web.ts

import { Router, Request, Response } from "express";
const { body, validationResult } = require("express-validator");

import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import { User } from "../models/User";
import { Todo } from "../models/Todo";
import { ensureAuth, AuthRequest } from "../middleware/auth";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";

// Redirect root to login
router.get("/", (_req, res) => res.redirect("/login"));

/**
 * REGISTER
 */
router
  .route("/register")
  .get((_, res) => {
    res.render("register", { errors: [], data: {} });
  })
  .post(
    // username ≥3 chars
    body("username")
      .trim()
      .isLength({ min: 3 })
      .withMessage("Username must be at least 3 characters"),
    // password strength
    body("password")
      .isStrongPassword({
        minLength: 8,
        minLowercase: 1,
        minUppercase: 1,
        minNumbers: 1,
        minSymbols: 1,
      })
      .withMessage(
        "Password must be at least 8 chars, include uppercase, lowercase, number & symbol"
      ),
    // inside your POST("/register") chain:
    body("confirmPassword")
    .custom((confirmPassword: string, { req }: { req: Request }) => {
        // req.body.password is typed, confirmPassword is string
        if (confirmPassword !== req.body.password) {
        throw new Error("Passwords do not match");
        }
        return true;  // must return true if validation passes
    }),
    async (req: Request, res: Response) => {
      const errors = validationResult(req);
      const data = { username: req.body.username };

      if (!errors.isEmpty()) {
        return res.status(400).render("register", {
          errors: errors.array(),
          data,
        });
      }

      // duplicate username?
      if (await User.findOne({ username: data.username })) {
        return res.status(400).render("register", {
          errors: [{ param: "username", msg: "Username already taken" }],
          data,
        });
      }

      // create user (password hashed in pre-save hook)
      await new User({
        username: data.username,
        password: req.body.password,
      }).save();

      res.redirect("/login");
    }
  );

/**
 * LOGIN
 */
router
  .route("/login")
  .get((_, res) => {
    res.render("login", { errors: [], data: {} });
  })
  .post(
    // username required
    body("username").trim().notEmpty().withMessage("Username is required"),
    // password required
    body("password").notEmpty().withMessage("Password cannot be blank"),
    async (req: Request, res: Response) => {
      const errors = validationResult(req);
      const data = { username: req.body.username };

      if (!errors.isEmpty()) {
        return res.status(400).render("login", {
          errors: errors.array(),
          data,
        });
      }

      const user = await User.findOne({ username: data.username });
      const valid = user && (await user.comparePassword(req.body.password));

      if (!user || !valid) {
        return res.status(400).render("login", {
          errors: [{ param: "password", msg: "Invalid username or password" }],
          data,
        });
      }

      // issue JWT
      const token = jwt.sign({ userId: user.id.toString() }, JWT_SECRET, {
        expiresIn: "2h",
      });
      res.cookie("token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: 2 * 60 * 60 * 1000,
      });

      res.redirect("/todos");
    }
  );

/**
 * LOGOUT
 */
router.post("/logout", ensureAuth, (_req, res) => {
  res.clearCookie("token");
  res.redirect("/login");
});

/**
 * TODOS (protected)
 */
router.get("/todos", ensureAuth, async (req: AuthRequest, res) => {
  const userId = req.userId!;
  const [todos, user] = await Promise.all([
    Todo.find({ userId }).sort({ createdAt: -1 }),
    User.findById(userId).lean(),
  ]);

  res.render("todos", {
    todos,
    user,
    errors: [],
  });
});

router.post(
  "/todos/add",
  ensureAuth,
  body("text").trim().notEmpty().withMessage("Todo text cannot be empty"),
  async (req: AuthRequest, res) => {
    const errors = validationResult(req);
    const userId = req.userId!;

    if (!errors.isEmpty()) {
      const [todos, user] = await Promise.all([
        Todo.find({ userId }).sort({ createdAt: -1 }),
        User.findById(userId).lean(),
      ]);
      return res.status(400).render("todos", {
        todos,
        user,
        errors: errors.array(),
      });
    }

    await new Todo({ text: req.body.text, userId }).save();
    res.redirect("/todos");
  }
);

router.post("/todos/:id/toggle", ensureAuth, async (req: AuthRequest, res) => {
  const userId = req.userId!;
  const todo = await Todo.findOne({ _id: req.params.id, userId });
  if (todo) {
    todo.completed = !todo.completed;
    await todo.save();
  }
  res.redirect("/todos");
});

router.post("/todos/:id/delete", ensureAuth, async (req: AuthRequest, res) => {
  const userId = req.userId!;
  await Todo.deleteOne({ _id: req.params.id, userId });
  res.redirect("/todos");
});

export default router;
