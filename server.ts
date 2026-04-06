import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Request Logger
  app.use((req, res, next) => {
    console.log(`[SERVER] ${req.method} ${req.url}`);
    next();
  });

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Email Sending Route
  app.post("/api/send-email", async (req, res) => {
    try {
      const { to, subject, text, html } = req.body;
      const user = process.env.SMTP_USER;
      const pass = process.env.SMTP_PASS;

      if (!user || !pass) {
        return res.status(400).json({ error: "Email configuration missing." });
      }

      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: { user, pass },
      });

      const info = await transporter.sendMail({
        from: `"FMS System" <${user}>`,
        to,
        subject,
        text,
        html,
      });

      res.json({ success: true, messageId: info.messageId });
    } catch (error: any) {
      console.error("Email Sending Error:", error);
      res.status(500).json({ error: error.message || "Failed to send email." });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

export default app;