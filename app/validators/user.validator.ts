import { body } from "express-validator";

export const updateUserValidator = [
  body("fullName").optional().isString(),
  body("email").optional().isEmail(),
  body("password").optional().isLength({ min: 6 }),
  body("status").optional().isIn(["active", "inactive"]),
];