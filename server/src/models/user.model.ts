import mongoose, { Schema, Document } from "mongoose";import bcrypt from "bcryptjs";

export interface IUser extends Document {
  username: string;
  email: string;
  password?: string; // Password might not always be present (e.g., OAuth)
  name?: string;
  globalPrompt?: string; // Added globalPrompt field
  createdAt: Date;
  updatedAt: Date;
  // Add other fields as needed: profilePicture, preferences, etc.

  // Method to compare password
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const UserSchema: Schema = new Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
      minlength: 3,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/.+\@.+\..+/, "Please fill a valid email address"], // Basic email format validation
      index: true,
    },
    password: {
      type: String,
      // required: true, // Not strictly required if using OAuth etc.
      select: false, // Prevent password from being returned by default
    },
    name: {
      type: String,
      trim: true,
    },
    globalPrompt: {
      // Added globalPrompt schema definition
      type: String,
      trim: true,
      default: null, // Or an empty string if preferred
    },
    // Add other fields here
  },
  { timestamps: true } // Adds createdAt and updatedAt automatically
);

// Pre-save hook to hash password
UserSchema.pre<IUser>("save", async function (next) {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified("password") || !this.password) {
    return next();
  }

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    // Ensure err is typed correctly or cast
    if (err instanceof Error) {
      return next(err);
    }
    // Fallback for unknown error types
    return next(new Error("Error hashing password"));
  }
});

// Method to compare password
UserSchema.methods.comparePassword = function (
  candidatePassword: string
): Promise<boolean> {
  if (!this.password) {
    console.error(
      "Attempted to compare password on a user document without a password field."
    );
    return Promise.resolve(false);
  }
  return bcrypt.compare(candidatePassword, this.password);
};

export const User = mongoose.model<IUser>("User", UserSchema);

export default User;
