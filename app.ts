  import express, { Request, Response, NextFunction } from "express";
  import cors from "cors";
  import morgan from "morgan";
  import dotenv from "dotenv";
  import http from "http";
  import { Server } from "socket.io";
  import userRoutes from "./app/routes/user";
  import authRoutes from "./app/routes/auth";
  import messageRoutes from "./app/routes/message";
  import testRoute from "./app/routes/testRoute";
  import { initKafka, producer } from "./app/kafka/kafka";

  dotenv.config();

  const app = express();
  const server = http.createServer(app);

  app.use(cors({ 
    origin: "http://localhost:3000", 
    credentials: true 
  }));

  const io = new Server(server, {
    cors: {
      origin: "http://localhost:3000",
      methods: ["GET", "POST"],
      allowedHeaders: ["Content-Type"],
      credentials: true,  
    },
  });

  export { io };
  
  const KAFKA_ENABLED = process.env.KAFKA_ENABLED === "true";

  app.use(cors());
  app.use(express.json());
  app.use(morgan("dev"));

  app.use("/api/users", userRoutes);
  app.use("/api/auth", authRoutes);
  app.use("/api/messages", messageRoutes);
  app.use("/api", testRoute);

  app.get("/", (req: Request, res: Response) => {
    res.status(200).send({
      message: "Welcome to Parkhya Connect!",
      error: false,
      status: 200,
    });
  });

  if (KAFKA_ENABLED) {
    initKafka(io).catch((err) => {
      console.error(
        "Kafka initialization failed, continuing without Kafka:",
        err.message
      );
    });
  }

  io.on("connection", (socket) => {
    console.log("A user connected");

    socket.on("sendMessage", async (data) => {
      console.log("Received message:", data);

      const { content, senderId } = { content: data, senderId: socket.id }; 

      if (KAFKA_ENABLED) {
        try {
          await producer.send({
            topic: "messages",
            messages: [{ value: JSON.stringify({ content, senderId }) }],
          });
        } catch (error) {
          console.error("Failed to send message to Kafka:", error.message);
        }
      }

      io.emit("receiveMessage", { content, senderId });
    });

    socket.on("disconnect", () => {
      console.log("A user disconnected");
    });
  });

  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    console.error(err.stack);
    res.status(500).send({ message: "Something went wrong!", error: true });
  });

  export { app, server };