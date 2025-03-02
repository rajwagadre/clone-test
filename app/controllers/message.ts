import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { io } from "../../app";

const prisma = new PrismaClient();

// export const sendMessage = async (req: Request, res: Response) => {
//   const { content, receiverId, type } = req.body;
//   const senderId = req.user.id;

//   try {
//     if (type === "private") {
//       const receiver = await prisma.user.findUnique({
//         where: { id: receiverId },
//       });

//       if (!receiver) {
//         return res.status(400).json({
//           message: "Receiver not found",
//           error: true,
//           status: 400,
//         });
//       }
//     }

//     const message = await prisma.message.create({
//       data: {
//         content,
//         senderId,
//         receiverId: type === "private" ? receiverId : null,
//         type: type || "private",
//       },
//     });

//     res.status(201).json({
//       message: "Message sent successfully",
//       data: message,
//       error: false,
//       status: 201,
//     });
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({
//       message: "Error sending message",
//       error: true,
//       status: 500,
//     });
//   }
// };


export const sendMessage = async (req: Request, res: Response) => {
  const { content, receiverId, type = "public" } = req.body; // Default type is 'public'
  const senderId = req.user.id;

  try {
    let finalReceiverId = receiverId || null; // Public messages don't have a receiver

    if (type === "private" && !receiverId) {
      return res.status(400).json({
        message: "Receiver ID is required for private messages",
        error: true,
        status: 400,
      });
    }

    if (type === "private") {
      const receiver = await prisma.user.findUnique({
        where: { id: receiverId },
      });

      if (!receiver) {
        return res.status(400).json({
          message: "Receiver not found",
          error: true,
          status: 400,
        });
      }
    } else {
      finalReceiverId = null;
    }

    const message = await prisma.message.create({
      data: {
        content,
        senderId,
        receiverId: finalReceiverId, 
        type,
      },
    });

    io.emit("newMessage", message);

    res.status(201).json({
      message: "Message sent successfully",
      data: message,
      error: false,
      status: 201,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Error sending message",
      error: true,
      status: 500,
    });
  }
};

// export const getMessages = async (req: Request, res: Response) => {
//   const { receiverId } = req.params;
//   const senderId = req.user.id;

//   try {
//     let messages;

//     if (receiverId) {
//       const receiver = await prisma.user.findUnique({
//         where: { id: receiverId },
//       });

//       if (!receiver) {
//         return res.status(400).json({
//           message: "Receiver not found",
//           error: true,
//           status: 400,
//         });
//       }

//       messages = await prisma.message.findMany({
//         where: {
//           OR: [
//             { senderId: senderId, receiverId: receiverId },
//             { senderId: receiverId, receiverId: senderId },
//           ],
//           type: "private",
//         },
//         orderBy: {
//           created_at: "asc",
//         },
//       });
//     } else {
//       messages = await prisma.message.findMany({
//         where: {
//           senderId: senderId,
//           type: "public",
//         },
//         orderBy: {
//           created_at: "asc",
//         },
//       });
//     }

//     res.status(200).json({
//       message: "Messages fetched successfully",
//       data: messages,
//       error: false,
//       status: 200,
//     });
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({
//       message: "Error fetching messages",
//       error: true,
//       status: 500,
//     });
//   }
// };

export const getMessages = async (req: Request, res: Response) => {
  const { receiverId } = req.params;
  const senderId = req.user.id;

  try {
    let messages;

    if (receiverId) {
      // Fetch Private Messages
      const receiver = await prisma.user.findUnique({
        where: { id: receiverId },
      });

      if (!receiver) {
        return res.status(400).json({
          message: "Receiver not found",
          error: true,
          status: 400,
        });
      }

      messages = await prisma.message.findMany({
        where: {
          OR: [
            { senderId: senderId, receiverId: receiverId },
            { senderId: receiverId, receiverId: senderId },
          ],
          type: "private",
        },
        orderBy: {
          created_at: "asc",
        },
      });
    } else {
      // Fetch Public Messages (Visible to everyone)
      messages = await prisma.message.findMany({
        where: { type: "public" },
        orderBy: {
          created_at: "asc",
        },
      });
    }

    res.status(200).json({
      message: "Messages fetched successfully",
      data: messages,
      error: false,
      status: 200,
    });
  } catch (error) {
    console.error("Error fetching messages:", error);
    res.status(500).json({
      message: "Error fetching messages",
      error: true,
      status: 500,
      details: error.message, // Debugging ke liye
    });
  }
};


export const updateMessage = async (req: Request, res: Response) => {
  const { messageId } = req.params;
  const { content } = req.body;
  const userId = req.user.id;

  try {
    console.log("Updating message:", messageId, "New Content:", content);

    const message = await prisma.message.findUnique({ where: { id: messageId } });

    if (!message) {
      return res.status(404).json({ message: "Message not found", error: true });
    }
    if (message.senderId !== userId) {
      return res.status(403).json({ message: "Unauthorized", error: true });
    }

    const updatedMessage = await prisma.message.update({
      where: { id: messageId },
      data: { content },
    });

    try {
      io.emit("messageUpdated", updatedMessage);
    } catch (socketError) {
      console.error("Socket.io emit error:", socketError);
    }

    res.status(200).json({ message: "Message updated", data: updatedMessage });
  } catch (error) {
    console.error("Error updating message:", error);
    res.status(500).json({ 
      message: "Error updating message", 
      error: true, 
      details: error.message  // Include error details for debugging
    });
  }
};

export const deleteMessage = async (req: Request, res: Response) => {
  const { messageId } = req.params;
  const userId = req.user.id;

  try {
    console.log("Deleting message:", messageId);

    const message = await prisma.message.findUnique({ where: { id: messageId } });

    if (!message) {
      return res.status(404).json({ message: "Message not found", error: true });
    }
    if (message.senderId !== userId) {
      return res.status(403).json({ message: "Unauthorized", error: true });
    }

    await prisma.message.delete({ where: { id: messageId } });

    try {
      io.emit("messageDeleted", { messageId });
    } catch (socketError) {
      console.error("Socket.io emit error:", socketError);
    }

    res.status(200).json({ message: "Message deleted successfully", error: false });
  } catch (error) {
    console.error("Error deleting message:", error);
    res.status(500).json({ 
      message: "Error deleting message", 
      error: true, 
      details: error.message // Include error details for debugging
    });
  }
};

