import { server } from "./app";

const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || "localhost";

server.listen(PORT, () => {
  console.log(`🚀 Server running on http://${HOST}:${PORT}`);
});
