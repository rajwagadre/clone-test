import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { io } from "../../app";

const prisma = new PrismaClient();

// Create a new channel
export const createChannel = async (req: Request, res: Response) => {
  try {
    const { name, description, isPrivate = false } = req.body;
    const userId = req.user.id;

    if (!name) {
      return res.status(400).json({
        message: "Channel name is required",
        error: true,
        status: 400,
      });
    }

    // Create the channel
    const channel = await prisma.channel.create({
      data: {
        name,
        description,
        isPrivate,
        createdBy: userId,
      },
    });

    // Add the creator as a member with admin role
    await prisma.channelMember.create({
      data: {
        channelId: channel.id,
        userId,
        role: "admin",
      },
    });

    // Get the channel with members
    const channelWithMembers = await prisma.channel.findUnique({
      where: { id: channel.id },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                email: true,
                avatar: true,
                status: true,
              },
            },
          },
        },
      },
    });

    // Format the response
    const formattedChannel = {
      ...channelWithMembers,
      members: channelWithMembers.members.map(member => member.user),
    };

    // Emit socket event for new channel
    io.emit("channelCreated", formattedChannel);

    res.status(201).json({
      message: "Channel created successfully",
      data: formattedChannel,
      error: false,
      status: 201,
    });
  } catch (error) {
    console.error("Error creating channel:", error);
    res.status(500).json({
      message: "Error creating channel",
      error: true,
      status: 500,
    });
  }
};

// Get all channels the user is a member of
export const getChannels = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;

    // Get all channels where the user is a member
    const channelMembers = await prisma.channelMember.findMany({
      where: { userId },
      include: {
        channel: {
          include: {
            members: {
              include: {
                user: {
                  select: {
                    id: true,
                    fullName: true,
                    email: true,
                    avatar: true,
                    status: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    // Format the response
    const channels = channelMembers.map(member => ({
      ...member.channel,
      members: member.channel.members.map(m => m.user),
    }));

    res.status(200).json({
      message: "Channels retrieved successfully",
      data: channels,
      error: false,
      status: 200,
    });
  } catch (error) {
    console.error("Error fetching channels:", error);
    res.status(500).json({
      message: "Error fetching channels",
      error: true,
      status: 500,
    });
  }
};

// Get a specific channel by ID
export const getChannelById = async (req: Request, res: Response) => {
  try {
    const { channelId } = req.params;
    const userId = req.user.id;

    // Check if the user is a member of the channel
    const membership = await prisma.channelMember.findUnique({
      where: {
        channelId_userId: {
          channelId,
          userId,
        },
      },
    });

    if (!membership) {
      return res.status(403).json({
        message: "You are not a member of this channel",
        error: true,
        status: 403,
      });
    }

    // Get the channel with members
    const channel = await prisma.channel.findUnique({
      where: { id: channelId },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                email: true,
                avatar: true,
                status: true,
              },
            },
          },
        },
      },
    });

    if (!channel) {
      return res.status(404).json({
        message: "Channel not found",
        error: true,
        status: 404,
      });
    }

    // Format the response
    const formattedChannel = {
      ...channel,
      members: channel.members.map(member => member.user),
    };

    res.status(200).json({
      message: "Channel retrieved successfully",
      data: formattedChannel,
      error: false,
      status: 200,
    });
  } catch (error) {
    console.error("Error fetching channel:", error);
    res.status(500).json({
      message: "Error fetching channel",
      error: true,
      status: 500,
    });
  }
};

// Add a member to a channel
export const addChannelMember = async (req: Request, res: Response) => {
  try {
    const { channelId } = req.params;
    const { userId } = req.body;
    const currentUserId = req.user.id;

    if (!userId) {
      return res.status(400).json({
        message: "User ID is required",
        error: true,
        status: 400,
      });
    }

    // Check if the current user is an admin of the channel
    const membership = await prisma.channelMember.findUnique({
      where: {
        channelId_userId: {
          channelId,
          userId: currentUserId,
        },
      },
    });

    if (!membership || membership.role !== "admin") {
      return res.status(403).json({
        message: "You don't have permission to add members to this channel",
        error: true,
        status: 403,
      });
    }

    // Check if the user to add exists
    const userToAdd = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!userToAdd) {
      return res.status(404).json({
        message: "User not found",
        error: true,
        status: 404,
      });
    }

    // Check if the user is already a member
    const existingMembership = await prisma.channelMember.findUnique({
      where: {
        channelId_userId: {
          channelId,
          userId,
        },
      },
    });

    if (existingMembership) {
      return res.status(400).json({
        message: "User is already a member of this channel",
        error: true,
        status: 400,
      });
    }

    // Add the user as a member
    await prisma.channelMember.create({
      data: {
        channelId,
        userId,
        role: "member",
      },
    });

    // Get the updated channel with members
    const updatedChannel = await prisma.channel.findUnique({
      where: { id: channelId },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                email: true,
                avatar: true,
                status: true,
              },
            },
          },
        },
      },
    });

    // Format the response
    const formattedChannel = {
      ...updatedChannel,
      members: updatedChannel.members.map(member => member.user),
    };

    // Emit socket event for member added
    io.emit("channelMemberAdded", {
      channelId,
      user: userToAdd,
    });

    res.status(200).json({
      message: "Member added to channel successfully",
      data: formattedChannel,
      error: false,
      status: 200,
    });
  } catch (error) {
    console.error("Error adding member to channel:", error);
    res.status(500).json({
      message: "Error adding member to channel",
      error: true,
      status: 500,
    });
  }
};

// Remove a member from a channel
export const removeChannelMember = async (req: Request, res: Response) => {
  try {
    const { channelId, userId } = req.params;
    const currentUserId = req.user.id;

    // Check if the current user is an admin of the channel
    const membership = await prisma.channelMember.findUnique({
      where: {
        channelId_userId: {
          channelId,
          userId: currentUserId,
        },
      },
    });

    if (!membership || membership.role !== "admin") {
      return res.status(403).json({
        message: "You don't have permission to remove members from this channel",
        error: true,
        status: 403,
      });
    }

    // Check if the user to remove exists and is a member
    const membershipToRemove = await prisma.channelMember.findUnique({
      where: {
        channelId_userId: {
          channelId,
          userId,
        },
      },
    });

    if (!membershipToRemove) {
      return res.status(404).json({
        message: "User is not a member of this channel",
        error: true,
        status: 404,
      });
    }

    // Don't allow removing the creator/admin
    if (membershipToRemove.role === "admin") {
      return res.status(400).json({
        message: "Cannot remove the channel admin",
        error: true,
        status: 400,
      });
    }

    // Remove the member
    await prisma.channelMember.delete({
      where: {
        channelId_userId: {
          channelId,
          userId,
        },
      },
    });

    // Emit socket event for member removed
    io.emit("channelMemberRemoved", {
      channelId,
      userId,
    });

    res.status(200).json({
      message: "Member removed from channel successfully",
      error: false,
      status: 200,
    });
  } catch (error) {
    console.error("Error removing member from channel:", error);
    res.status(500).json({
      message: "Error removing member from channel",
      error: true,
      status: 500,
    });
  }
};

// Get messages for a specific channel
export const getChannelMessages = async (req: Request, res: Response) => {
  try {
    const { channelId } = req.params;
    const userId = req.user.id;

    // Check if the user is a member of the channel
    const membership = await prisma.channelMember.findUnique({
      where: {
        channelId_userId: {
          channelId,
          userId,
        },
      },
    });

    if (!membership) {
      return res.status(403).json({
        message: "You are not a member of this channel",
        error: true,
        status: 403,
      });
    }

    // Get messages for the channel
    const messages = await prisma.message.findMany({
      where: {
        channelId,
        type: "channel",
      },
      include: {
        sender: {
          select: {
            id: true,
            fullName: true,
            email: true,
            avatar: true,
          },
        },
      },
      orderBy: {
        created_at: "asc",
      },
    });

    res.status(200).json({
      message: "Channel messages retrieved successfully",
      data: messages,
      error: false,
      status: 200,
    });
  } catch (error) {
    console.error("Error fetching channel messages:", error);
    res.status(500).json({
      message: "Error fetching channel messages",
      error: true,
      status: 500,
    });
  }
};

// Delete a channel (only by the creator)
export const deleteChannel = async (req: Request, res: Response) => {
  try {
    const { channelId } = req.params;
    const userId = req.user.id;

    // Check if the channel exists
    const channel = await prisma.channel.findUnique({
      where: { id: channelId },
    });

    if (!channel) {
      return res.status(404).json({
        message: "Channel not found",
        error: true,
        status: 404,
      });
    }

    // Check if the user is the creator of the channel
    if (channel.createdBy !== userId) {
      return res.status(403).json({
        message: "Only the channel creator can delete the channel",
        error: true,
        status: 403,
      });
    }

    // Delete the channel (this will cascade delete members and messages)
    await prisma.channel.delete({
      where: { id: channelId },
    });

    // Emit socket event for channel deleted
    io.emit("channelDeleted", { channelId });

    res.status(200).json({
      message: "Channel deleted successfully",
      error: false,
      status: 200,
    });
  } catch (error) {
    console.error("Error deleting channel:", error);
    res.status(500).json({
      message: "Error deleting channel",
      error: true,
      status: 500,
    });
  }
};

// Update a channel (name, description, privacy)
export const updateChannel = async (req: Request, res: Response) => {
  try {
    const { channelId } = req.params;
    const { name, description, isPrivate } = req.body;
    const userId = req.user.id;

    // Check if the channel exists
    const channel = await prisma.channel.findUnique({
      where: { id: channelId },
    });

    if (!channel) {
      return res.status(404).json({
        message: "Channel not found",
        error: true,
        status: 404,
      });
    }

    // Check if the user is an admin of the channel
    const membership = await prisma.channelMember.findUnique({
      where: {
        channelId_userId: {
          channelId,
          userId,
        },
      },
    });

    if (!membership || membership.role !== "admin") {
      return res.status(403).json({
        message: "Only channel admins can update the channel",
        error: true,
        status: 403,
      });
    }

    // Update the channel
    const updatedChannel = await prisma.channel.update({
      where: { id: channelId },
      data: {
        name: name !== undefined ? name : channel.name,
        description: description !== undefined ? description : channel.description,
        isPrivate: isPrivate !== undefined ? isPrivate : channel.isPrivate,
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                email: true,
                avatar: true,
                status: true,
              },
            },
          },
        },
      },
    });

    // Format the response
    const formattedChannel = {
      ...updatedChannel,
      members: updatedChannel.members.map(member => member.user),
    };

    // Emit socket event for channel updated
    io.emit("channelUpdated", formattedChannel);

    res.status(200).json({
      message: "Channel updated successfully",
      data: formattedChannel,
      error: false,
      status: 200,
    });
  } catch (error) {
    console.error("Error updating channel:", error);
    res.status(500).json({
      message: "Error updating channel",
      error: true,
      status: 500,
    });
  }
};