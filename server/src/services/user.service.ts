import User, { IUser } from "../models/user.model";class UserService {
  async createUser(userData: Partial<IUser>): Promise<IUser> {
    if (!userData.username) {
      throw new Error("Username is required to create user.");
    }
    // Ensure email is still provided if schema requires it
    if (!userData.email) {
      throw new Error("Email is required to create user.");
    }
    // The pre-save hook in the model will handle password hashing
    const user = new User(userData);
    await user.save();
    // We need to manually remove the password for the returned object
    // since .save() doesn't respect `select: false` for the returned doc
    const userObject = user.toObject();
    delete userObject.password;
    return userObject as IUser;
  }

  async findUserByUsername(
    username: string
  ): Promise<
    (IUser & { comparePassword: (password: string) => Promise<boolean> }) | null
  > {
    // Need to explicitly select password for login comparison
    return User.findOne({ username: username.toLowerCase() })
      .select("+password")
      .exec();
  }

  async findUserByEmail(
    email: string
  ): Promise<
    (IUser & { comparePassword: (password: string) => Promise<boolean> }) | null
  > {
    // Need to explicitly select password for login comparison
    return User.findOne({ email }).select("+password").exec();
  }

  async findUserById(id: string): Promise<IUser | null> {
    // Password should not be selected by default here
    return User.findById(id).exec();
  }

  async updateUserPrompt(
    userId: string,
    prompt: string
  ): Promise<IUser | null> {
    return User.findByIdAndUpdate(
      userId,
      { $set: { globalPrompt: prompt } },
      { new: true } // Return the updated document
    ).exec();
  }

  // Add other user-related methods as needed (update, delete, etc.)
}

export const userService = new UserService();
