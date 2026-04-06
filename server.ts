import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Request Logger
app.use((req, res, next) => {
  console.log(`[SERVER] ${req.method} ${req.url}`);
  next();
});

const apiRouter = express.Router();

// API routes
apiRouter.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Email Sending Route
apiRouter.post("/send-email", async (req, res) => {
  console.log(`[API] Attempting to send email to: ${req.body.to}`);
  try {
    const { to, subject, text, html } = req.body;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (!user || !pass) {
      console.error("[API] SMTP Credentials missing in environment variables");
      return res.status(400).json({ error: "Email configuration missing on server." });
    }

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user, pass },
    });

    // Verify connection configuration
    try {
      await transporter.verify();
      console.log("[API] SMTP Connection verified successfully");
    } catch (verifyError) {
      console.error("[API] SMTP Verification failed:", verifyError);
      throw verifyError;
    }

    const info = await transporter.sendMail({
      from: `"FMS System" <${user}>`,
      to,
      subject,
      text,
      html,
    });

    console.log("[API] Email sent successfully:", info.messageId);
    res.json({ success: true, messageId: info.messageId });
  } catch (error: any) {
    console.error("[API] Email Sending Error details:", error);
    res.status(500).json({ 
      error: error.message || "Failed to send email.",
      code: error.code,
      command: error.command
    });
  }
});

// Mount the router at both /api and / for maximum compatibility
app.use("/api", apiRouter);
app.use("/", apiRouter);

async function startServer() {
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