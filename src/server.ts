// import app from "./app";
import { httpServer } from "./app";
import dotenv from "dotenv";

dotenv.config();

const PORT = process.env.PORT || 3001;

httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`Backend running on http://localhost:${PORT}`);
  console.log(`🔌 Socket.IO ready for connections`);
  console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(
    `Database URL configured: ${process.env.DATABASE_URL ? "Yes" : "No"}`
  );
});
