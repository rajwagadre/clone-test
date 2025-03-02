import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export const authenticate = (req: Request, res: Response, next: NextFunction) => {
    const token = req.headers.authorization as string;
  
    if (!token) {
      return res.status(401).json({
        message: "No token provided",
        error: true,
        status: 401,
      });
    }
  
    const tokenWithoutBearer = token.startsWith("Bearer ") ? token.slice(7) : token;
  
    jwt.verify(tokenWithoutBearer, process.env.JWT_SECRET!, (err, decoded) => {
      if (err) {
        return res.status(401).json({
          message: "Unauthorized",
          error: true,
          status: 401,
        });
      }
  
      req.user = decoded;
      next();
    });
  };
  