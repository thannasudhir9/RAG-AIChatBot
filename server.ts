import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import multer from "multer";
import fs from "fs";
// @ts-ignore
import pdf from "pdf-parse";
import mammoth from "mammoth";
import { parse as parseCsv } from "csv-parse/sync";
import { GoogleGenAI } from "@google/genai";
import cors from "cors";

// --- Types ---
interface DocumentChunk {
  id: string;
  documentId: string;
  filename: string;
  content: string;
  embedding: number[];
  metadata: {
    page?: number;
    chunkIndex: number;
  };
}

interface DocumentMetadata {
  id: string;
  filename: string;
  uploadDate: string;
  chunkCount: number;
  fileType: string;
}

// --- Global State (In-memory for this demo, can be persisted to JSON) ---
let vectorStore: DocumentChunk[] = [];
let documents: DocumentMetadata[] = [];
const STORAGE_PATH = path.join(process.cwd(), "vector_store.json");

// Load existing store if available
if (fs.existsSync(STORAGE_PATH)) {
  try {
    const data = JSON.parse(fs.readFileSync(STORAGE_PATH, "utf-8"));
    vectorStore = data.vectorStore || [];
    documents = data.documents || [];
    console.log(`Loaded ${documents.length} documents and ${vectorStore.length} chunks.`);
  } catch (e) {
    console.error("Failed to load vector store:", e);
  }
}

function saveStore() {
  fs.writeFileSync(STORAGE_PATH, JSON.stringify({ vectorStore, documents }, null, 2));
}

// --- AI Setup ---
const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

async function getEmbedding(text: string) {
  const result = await genAI.models.embedContent({
    model: "text-embedding-004",
    contents: [text]
  });
  return result.embeddings[0].values;
}

function cosineSimilarity(vecA: number[], vecB: number[]) {
  let dotProduct = 0;
  let mA = 0;
  let mB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    mA += vecA[i] * vecA[i];
    mB += vecB[i] * vecB[i];
  }
  mA = Math.sqrt(mA);
  mB = Math.sqrt(mB);
  return dotProduct / (mA * mB);
}

// --- Chunking Logic ---
function chunkText(text: string, size: number = 500, overlap: number = 50): string[] {
  const words = text.split(/\s+/);
  const chunks: string[] = [];
  for (let i = 0; i < words.length; i += (size - overlap)) {
    chunks.push(words.slice(i, i + size).join(" "));
    if (i + size >= words.length) break;
  }
  return chunks;
}

// --- Server Setup ---
async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  const upload = multer({ storage: multer.memoryStorage() });

  // --- API Routes ---

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/api/documents", (req, res) => {
    res.json(documents);
  });

  app.delete("/api/documents/:id", (req, res) => {
    const { id } = req.params;
    documents = documents.filter(d => d.id !== id);
    vectorStore = vectorStore.filter(c => c.documentId !== id);
    saveStore();
    res.json({ success: true });
  });

  app.post("/api/upload", upload.array("files"), async (req, res) => {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return res.status(400).json({ error: "No files uploaded" });
    }

    try {
      for (const file of files) {
        let text = "";
        const fileType = path.extname(file.originalname).toLowerCase();

        if (fileType === ".pdf") {
          const data = await pdf(file.buffer);
          text = data.text;
        } else if (fileType === ".docx") {
          const result = await mammoth.extractRawText({ buffer: file.buffer });
          text = result.value;
        } else if (fileType === ".csv") {
          const records = parseCsv(file.buffer.toString());
          text = records.map((r: any) => Object.values(r).join(", ")).join("\n");
        } else if (fileType === ".txt") {
          text = file.buffer.toString();
        } else {
          continue; // Skip unsupported
        }

        const docId = Math.random().toString(36).substring(7);
        const chunks = chunkText(text);
        
        const chunkPromises = chunks.map(async (content, index) => {
          const embedding = await getEmbedding(content);
          return {
            id: `${docId}-${index}`,
            documentId: docId,
            filename: file.originalname,
            content,
            embedding,
            metadata: { chunkIndex: index }
          };
        });

        const indexedChunks = await Promise.all(chunkPromises);
        vectorStore.push(...indexedChunks);
        
        documents.push({
          id: docId,
          filename: file.originalname,
          uploadDate: new Date().toISOString(),
          chunkCount: chunks.length,
          fileType
        });
      }

      saveStore();
      res.json({ success: true, documents });
    } catch (error) {
      console.error("Upload error:", error);
      res.status(500).json({ error: "Failed to process documents" });
    }
  });

  app.post("/api/chat", async (req, res) => {
    const { question, history = [] } = req.body;

    if (!question) return res.status(400).json({ error: "Question is required" });

    try {
      // 1. Get embedding for question
      const questionEmbedding = await getEmbedding(question);

      // 2. Retrieval (Similarity Search)
      const scoredChunks = vectorStore.map(chunk => ({
        ...chunk,
        score: cosineSimilarity(questionEmbedding, chunk.embedding)
      }));

      const topChunks = scoredChunks
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);

      if (topChunks.length === 0) {
        return res.json({ 
          answer: "I don't have any documents to answer from. Please upload some files first.",
          sources: [] 
        });
      }

      // 3. Construct Prompt
      const context = topChunks.map(c => `[Source: ${c.filename}] ${c.content}`).join("\n\n");
      
      const prompt = `
SYSTEM: You are a helpful assistant that answers questions ONLY based on the provided context. 
If the answer is not in the context, say "I don't know based on the documents provided."
Do not use outside knowledge. Always cite your sources by mentioning the filename.

CONTEXT:
${context}

CHAT HISTORY:
${history.map((m: any) => `${m.role.toUpperCase()}: ${m.content}`).join("\n")}

QUESTION:
${question}
      `;

      const result = await genAI.models.generateContent({
        model: "gemini-1.5-flash",
        contents: [{ role: "user", parts: [{ text: prompt }] }]
      });
      const answer = result.text || "I couldn't generate an answer.";

      res.json({
        answer,
        sources: topChunks.map(c => ({
          filename: c.filename,
          content: c.content.substring(0, 200) + "...",
          score: c.score
        }))
      });
    } catch (error) {
      console.error("Chat error:", error);
      res.status(500).json({ error: "Failed to generate response" });
    }
  });

  // --- Vite Middleware ---
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
