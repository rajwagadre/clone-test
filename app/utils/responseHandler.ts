import { Response } from "express";

export const responseHandler = (
  res: Response,
  status: number,
  message: string,
  data: any = null
) => {
  const response: any = {
    success: status < 400,
    message,
  };

  if (data !== null) {
    response.data = data;
  }

  return res.status(status).json(response);
};
