import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { google } from "googleapis";
import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Google Sheets Sync Route
  app.post("/api/sync-sheets", async (req, res) => {
    try {
      const { projects } = req.body;
      const sheetId = process.env.GOOGLE_SHEET_ID;
      const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;

      if (!sheetId || !serviceAccountKey) {
        return res.status(400).json({ error: "Google Sheets configuration missing." });
      }

      let credentials;
      try {
        credentials = JSON.parse(serviceAccountKey);
      } catch (e) {
        return res.status(400).json({ error: "Invalid Google Service Account Key format." });
      }

      const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
      });

      const sheets = google.sheets({ version: "v4", auth });

      // Prepare headers
      const headers = [
        "Project Name", "Customer", "PO Number", "PO Date", "Article", "Color", 
        "Order Date", "Dispatch Date", "Current Step", "Status", "Created At"
      ];

      // Prepare rows
      const rows = projects.map((p: any) => [
        p.project_name,
        p.customer_name,
        p.po_number,
        p.po_date,
        p.article_name,
        p.color,
        p.order_date,
        p.dispatch_date,
        p.steps[p.current_step_index]?.name || 'Completed',
        p.status,
        p.created_at
      ]);

      const values = [headers, ...rows];

      // Update the sheet
      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: "Sheet1!A1",
        valueInputOption: "RAW",
        requestBody: { values },
      });

      res.json({ success: true, message: "Google Sheet updated successfully." });
    } catch (error: any) {
      console.error("Google Sheets Sync Error:", error);
      res.status(500).json({ error: error.message || "Failed to sync with Google Sheets." });
    }
  });

  // Google Sheets Append Entry Route
  app.post("/api/append-entry", async (req, res) => {
    try {
      const { entries } = req.body;
      const sheetId = process.env.GOOGLE_SHEET_ID;
      const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;

      if (!sheetId || !serviceAccountKey) {
        return res.status(400).json({ error: "Google Sheets configuration missing." });
      }

      let credentials;
      try {
        credentials = JSON.parse(serviceAccountKey);
      } catch (e) {
        return res.status(400).json({ error: "Invalid Google Service Account Key format." });
      }

      const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
      });

      const sheets = google.sheets({ version: "v4", auth });

      // Get current data to determine serial number and next row
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: "Sheet1!A9:A",
      });

      const existingRows = response.data.values || [];
      let nextSerialNumber = existingRows.length + 1;
      const timestamp = new Date().toLocaleString();

      const rowsToAppend = entries.map((item: any, index: number) => [
        nextSerialNumber + index,
        timestamp,
        item.customerName,
        item.projectName,
        item.poNumber,
        item.poDate,
        item.articleName,
        item.color,
        item.orderDate,
        item.dispatchDate,
        item.remark
      ]);

      // Append to the sheet starting from A9
      // If the sheet is empty below row 8, it will start at A9
      await sheets.spreadsheets.values.append({
        spreadsheetId: sheetId,
        range: "Sheet1!A9",
        valueInputOption: "RAW",
        requestBody: { values: rowsToAppend },
      });

      res.json({ success: true, message: "Entries appended to Google Sheet." });
    } catch (error: any) {
      console.error("Google Sheets Append Error:", error);
      res.status(500).json({ error: error.message || "Failed to append to Google Sheets." });
    }
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
