import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const createUser = async (data: {
  fullName?: string;
  mobileNumber?: string;
  email: string;
  password: string;
  socialId?: string;
  avatar?: string;
}) => {
  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [{ email: data.email }, { mobileNumber: data.mobileNumber }],
    },
  });

  if (existingUser) {
    throw new Error("User with this email or mobile number already exists.");
  }

  return await prisma.user.create({ data });
};

export const findUserByEmail = async (email: string) => {
  return await prisma.user.findUnique({ where: { email } });
};

export const findUserBySocialId = async (socialId: string) => {
  return await prisma.user.findUnique({ where: { socialId } });
};

export const getUsers = async (
  searchTerm?: string,
  page: number = 1,
  limit: number = 10
) => {
  const query: any = {};

  if (searchTerm) {
    query.OR = [
      { email: { contains: searchTerm, mode: "insensitive" } },
      { mobileNumber: { contains: searchTerm, mode: "insensitive" } },
      { fullName: { contains: searchTerm, mode: "insensitive" } },
    ];
  }

  const users = await prisma.user.findMany({
    where: query,
    skip: (page - 1) * limit,
    take: limit,
  });

  const totalUsers = await prisma.user.count({ where: query });

  return {
    users,
    totalUsers,
    totalPages: Math.ceil(totalUsers / limit),
    currentPage: page,
  };
};

export const getUserById = async (id: string) => {
  return await prisma.user.findUnique({ where: { id } });
};

export const updateUser = async (id: string, data: { socialId?: string }) => {
  return await prisma.user.update({
    where: { id },
    data,
  });
};

export const deleteUser = async (id: string) => {
  return await prisma.user.delete({ where: { id } });
};

export const saveResetToken = async (email: string, token: string) => {
  try {
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      console.error("No user found with this email");
      return false;
    }

    await prisma.user.update({
      where: { email },
      data: { resetToken: token },
    });

    return true;
  } catch (error) {
    console.error("Error saving reset token:", error);
    return false;
  }
};

export const updatePassword = async (email: string, newPassword: string) => {
  return await prisma.user.update({
    where: { email },
    data: { password: newPassword },
  });
};

export const findUserByMobile = async (mobileNumber: string) => {
  return await prisma.user.findUnique({
    where: { mobileNumber },
  });
};

export const verifyResetToken = async (email: string, token: string) => {
  const storedToken = await db.resetTokens.findFirst({
    where: { email, token },
  });

  return !!storedToken;
};

export const deleteResetToken = async (email: string) => {
  await db.resetTokens.deleteMany({ where: { email } });
};
