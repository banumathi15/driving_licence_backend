import "dotenv/config";
import express from "express";
import cors from "cors";
import multer from "multer";
import crypto from "node:crypto";
import { processDocument } from "./services/documentService.js";
import { extractLicenceFields } from "./services/extractionService.js";
import { answerDocumentQuestion } from "./services/ragService.js";
import { reviewedLicenceSchema } from "./schemas.js";

const app = express();
const port = Number(process.env.PORT || 4000);
const maxFileMb = Math.max(1, Number(process.env.MAX_FILE_MB || 10));
const documents = new Map();

app.disable("x-powered-by");
app.use(cors({ origin: process.env.FRONTEND_ORIGIN || "http://localhost:5173" }));
app.use(express.json({ limit: "100kb" }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxFileMb * 1024 * 1024, files: 1 }
});

function safeDocument(doc) {
  return {
    documentId: doc.id,
    originalName: doc.originalName,
    fields: doc.fields,
    pages: doc.pages.map(p => ({ page: p.page, text: p.text })),
    extractedText: doc.text,
    mode: doc.mode,
    warnings: doc.warnings
  };
}

app.get("/api/health", (_req, res) => res.json({ status: "ok", llmConfigured: Boolean(process.env.OPENAI_API_KEY) }));

app.post("/api/documents", upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: "Please select a document to upload." });
    const allowedMime = new Set(["application/pdf", "image/png", "image/jpeg"]);
    if (!allowedMime.has(req.file.mimetype)) {
      return res.status(415).json({ error: "Unsupported file type. Upload a PDF, PNG, or JPEG." });
    }
    const processed = await processDocument(req.file.buffer, req.file.originalname);
    const extraction = await extractLicenceFields(processed.text);
    const id = crypto.randomUUID();
    const doc = {
      id, originalName: processed.originalName, pages: processed.pages, text: processed.text,
      fields: extraction.fields, mode: extraction.mode, warnings: extraction.warning ? [extraction.warning] : [],
      createdAt: Date.now()
    };
    documents.set(id, doc);
    // In-memory demo session cleanup: expire documents after 2 hours.
    setTimeout(() => documents.delete(id), 2 * 60 * 60 * 1000).unref?.();
    return res.status(201).json(safeDocument(doc));
  } catch (error) { next(error); }
});

app.get("/api/documents/:id", (req, res) => {
  const doc = documents.get(req.params.id);
  if (!doc) return res.status(404).json({ error: "Document not found or session expired. Please upload it again." });
  res.json(safeDocument(doc));
});

app.put("/api/documents/:id", (req, res) => {
  const doc = documents.get(req.params.id);
  if (!doc) return res.status(404).json({ error: "Document not found or session expired." });
  const parsed = reviewedLicenceSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Some fields are invalid.", details: parsed.error.issues.map(i => ({ field: i.path.join("."), message: i.message })) });
  doc.fields = parsed.data;
  res.json({ fields: doc.fields, message: "Reviewed fields saved for this session." });
});

app.post("/api/documents/:id/chat", async (req, res, next) => {
  try {
    const doc = documents.get(req.params.id);
    if (!doc) return res.status(404).json({ error: "Document not found or session expired. Please upload it again." });
    const question = typeof req.body?.question === "string" ? req.body.question.trim() : "";
    if (!question) return res.status(400).json({ error: "Enter a question." });
    if (question.length > 1000) return res.status(400).json({ error: "Question must be 1000 characters or fewer." });
    const result = await answerDocumentQuestion(question, doc.pages);
    res.json(result);
  } catch (error) { next(error); }
});

app.use((error, _req, res, _next) => {
  if (error instanceof multer.MulterError) {
    const message = error.code === "LIMIT_FILE_SIZE" ? `File exceeds the ${maxFileMb} MB limit.` : "Invalid upload.";
    return res.status(400).json({ error: message });
  }
  const status = Number(error.status) || 500;
  if (status >= 500) console.error("Request failed:", error.message);
  res.status(status).json({ error: status >= 500 ? "Something went wrong while processing the document. Please try again." : error.message });
});

app.listen(port, () => console.log(`Driving Licence AI API listening on http://localhost:${port}`));
