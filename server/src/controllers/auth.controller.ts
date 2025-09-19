import { Router, Request, Response } from "express";import jwt from "jsonwebtoken";
import { userService } from "../services/user.service"; // Import UserService
import { authMiddleware } from "../middlewares/auth.middleware";

const router = Router();

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user
 * @access  Public
 */
router.post("/register", async (req: Request, res: Response) => {
  const { username, email, password, name } = req.body;

  if (!username || !email || !password) {
    return res
      .status(400)
      .json({ message: "Username, email and password are required" });
  }
  if (username.length < 3) {
    return res
      .status(400)
      .json({ message: "Username must be at least 3 characters" });
  }

  try {
    // Check if username or email already exists
    const existingUserByUsername =
      await userService.findUserByUsername(username);
    if (existingUserByUsername) {
      return res.status(400).json({ message: "Username already taken" });
    }
    const existingUserByEmail = await userService.findUserByEmail(email);
    if (existingUserByEmail) {
      return res.status(400).json({ message: "Email already registered" });
    }

    // Create user using UserService
    const newUser = await userService.createUser({
      username,
      email,
      password,
      name: name || username,
    });

    // Generate JWT (include username? optional)
    const token = jwt.sign(
      { id: newUser._id, email: newUser.email, username: newUser.username },
      process.env.JWT_SECRET || "your-secret-key",
      { expiresIn: "7d" }
    );

    res.status(201).json({
      token,
      user: {
        id: newUser._id,
        username: newUser.username,
        email: newUser.email,
        name: newUser.name,
      },
    });
  } catch (error) {
    console.error("Registration Error:", error); // Log the error
    res.status(500).json({
      message: "Error registering user",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * @route   POST /api/auth/login
 * @desc    Authenticate user & get token
 * @access  Public
 */
router.post("/login", async (req: Request, res: Response) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res
      .status(400)
      .json({ message: "Username and password are required" });
  }

  // Handle Regular Login
  try {
    // Find user by username using UserService
    const user = await userService.findUserByUsername(username);

    if (!user || !user.password) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Check password using the model method
    const isMatch = await user.comparePassword(password);

    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Generate JWT
    const token = jwt.sign(
      { id: user._id, email: user.email, username: user.username }, // Add username
      process.env.JWT_SECRET || "your-secret-key",
      { expiresIn: "7d" }
    );

    // Return user data without password
    const userObject = user.toObject();
    delete userObject.password;

    res.json({
      token,
      user: userObject,
    });
  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({
      message: "Error logging in",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * @route   GET /api/auth/me
 * @desc    Get current user
 * @access  Private
 */
router.get("/me", authMiddleware, async (req: Request, res: Response) => {
  // req.user is populated by authMiddleware with data from the token
  // We fetch the latest user data from the DB for the response
  if (!req.user) {
    // Should be caught by authMiddleware, but good practice to check
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const user = await userService.findUserById(req.user.id);

    if (!user) {
      // This might happen if the user was deleted after the token was issued
      return res
        .status(404)
        .json({ message: "User associated with token not found" });
    }

    // Return user data (password is not selected by findUserById)
    res.json(user);
  } catch (error) {
    console.error("Get Me Error:", error);
    res.status(500).json({
      message: "Error fetching user data",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export default router;
