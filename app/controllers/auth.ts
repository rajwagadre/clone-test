import { Request, Response } from "express";
import * as userService from "../services/user.service";
import { responseHandler } from "../utils/responseHandler";
import { ISocialLoginPayload } from "../types/user";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { uploadImageToCloudinary } from "../helpers/cloudinaryConfig";
import { sendResetPasswordEmail } from "../helpers/emailService";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";

export const register = async (req: Request, res: Response) => {
  try {
    const { fullName, mobileNumber, email, password } = req.body;

    if (!email || !password || !mobileNumber) {
      return responseHandler(
        res,
        400,
        "Email, password, and mobile number are required"
      );
    }

    const existingUserByEmail = await userService.findUserByEmail(email);
    if (existingUserByEmail) {
      return responseHandler(
        res,
        400,
        "A user with this email already exists. Please use a different email."
      );
    }

    const existingUserByMobile = await userService.findUserByMobile(
      mobileNumber
    );
    if (existingUserByMobile) {
      return responseHandler(
        res,
        400,
        "A user with this mobile number already exists. Please use a different number."
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    let avatarUrl: string | null = null;
    if (req.files && req.files.length > 0) {
      const uploadResult = await uploadImageToCloudinary(req.files[0].buffer);
      avatarUrl = uploadResult;
    }

    const user = await userService.createUser({
      fullName,
      mobileNumber,
      email,
      password: hashedPassword,
      avatar: avatarUrl,
    });

    return responseHandler(res, 201, "User registered successfully", user);
  } catch (error: any) {
    console.error("Register Error:", error);

    if (
      error.code === "P2002" &&
      error.meta?.target?.includes("mobileNumber")
    ) {
      return responseHandler(
        res,
        400,
        "A user with this mobile number already exists. Please use a different number."
      );
    }

    return responseHandler(
      res,
      500,
      "An unexpected error occurred while registering the user. Please try again later.",
      error
    );
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return responseHandler(res, 400, "Email and password are required");
    }

    const user = await userService.findUserByEmail(email);
    if (!user) {
      return responseHandler(res, 401, "Invalid email or password");
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return responseHandler(res, 401, "Invalid email or password");
    }

    const authToken = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, {
      expiresIn: "7d",
    });

    responseHandler(res, 200, "Login successful", {
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        avatar: user.avatar,
        status: user.status,
      },
      token: authToken,
    });
  } catch (error) {
    console.error("Login Error:", error);
    responseHandler(res, 500, "Internal Server Error");
  }
};

export const socialLogin = async (req: Request, res: Response) => {
  try {
    const { provider, token, profile }: ISocialLoginPayload = req.body;

    if (!profile || !profile.id || !profile.email) {
      return responseHandler(res, 400, "Invalid social profile data");
    }

    let user = await userService.findUserBySocialId(profile.id);
    if (!user) {
      user = await userService.findUserByEmail(profile.email);
      if (user) {
        user = await userService.updateUser(user.id, { socialId: profile.id });
      } else {
        const randomPassword = Math.random().toString(36).slice(-10);
        const hashedPassword = await bcrypt.hash(randomPassword, 10);

        user = await userService.createUser({
          fullName: profile.name || "User",
          email: profile.email,
          password: hashedPassword,
          socialId: profile.id,
          avatar: profile.picture,
        });
      }
    }

    const authToken = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, {
      expiresIn: "7d",
    });

    responseHandler(res, 200, `Login successful via ${provider}`, {
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        avatar: user.avatar,
        status: user.status,
      },
      token: authToken,
    });
  } catch (error) {
    console.error("Social login error:", error);
    responseHandler(res, 400, "Error processing social login", error);
  }
};

export const forgotPassword = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return responseHandler(res, 400, "Email is required");
    }

    const user = await userService.findUserByEmail(email);
    if (!user) {
      return responseHandler(res, 404, "User with this email does not exist");
    }

    const token = jwt.sign({ email }, JWT_SECRET, { expiresIn: "15m" });

    const isTokenSaved = await userService.saveResetToken(email, token);
    if (!isTokenSaved) {
      throw new Error("Failed to save reset token");
    }

    await sendResetPasswordEmail(email, token);

    return responseHandler(res, 200, "Password reset link sent to your email.");
  } catch (error) {
    console.error("Forgot Password Error:", error);
    return responseHandler(res, 500, "Error sending reset link", {
      error: error.message,
    });
  }
};

export const resetPassword = async (req: Request, res: Response) => {
  try {
    const { token, newPassword, confirmPassword } = req.body;

    if (!token || !newPassword || !confirmPassword) {
      return responseHandler(
        res,
        400,
        "Token, new password, and confirm password are required"
      );
    }
    if (newPassword.length < 8) {
      return responseHandler(
        res,
        400,
        "Password must be at least 8 characters long"
      );
    }

    if (newPassword !== confirmPassword) {
      return responseHandler(res, 400, "Passwords do not match");
    }

    const decoded: any = jwt.verify(token, JWT_SECRET);
    if (!decoded || !decoded.email) {
      return responseHandler(res, 400, "Invalid or expired token");
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await userService.updatePassword(decoded.email, hashedPassword);

    return responseHandler(res, 200, "Password reset successfully");
  } catch (error) {
    console.error("Reset Password Error:", error);
    return responseHandler(res, 400, "Invalid or expired token", {
      error: error.message,
    });
  }
};
