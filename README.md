# RAG Chatbot System

A production-ready Retrieval-Augmented Generation (RAG) application built with React, Express, and Gemini AI.

## 🚀 Features

- **Document Upload**: Support for PDF, DOCX, TXT, and CSV files.
- **Intelligent Processing**: Automatic text extraction and chunking (500 tokens with 50 overlap).
- **Vector Search**: Local vector storage with cosine similarity retrieval.
- **Grounded Chat**: AI responses are strictly grounded in your uploaded documents.
- **Source Attribution**: Every answer includes citations with filenames and section references.
- **Clean UI**: Modern, responsive chat interface with document management.

## 🛠️ Tech Stack

- **Frontend**: React, Vite, Tailwind CSS, Lucide Icons, Framer Motion.
- **Backend**: Node.js, Express (Full-stack setup).
- **AI/LLM**: Google Gemini API (for Embeddings and Chat).
- **Parsing**: `pdf-parse`, `mammoth`, `csv-parse`.

## 📂 Project Structure

```
/
├── server.ts            # Express backend (API routes & RAG logic)
├── src/
│   ├── App.tsx          # Main React application
│   ├── types.ts         # Shared TypeScript interfaces
├── metadata.json        # App metadata
├── package.json         # Dependencies and scripts
├── Dockerfile           # Docker configuration
└── docker-compose.yml   # Docker Compose configuration
```

## ⚙️ Setup & Installation

### Manual Setup (Local)

1. **Clone the repository**:
   ```bash
   git clone <your-repo-url>
   cd rag-chatbot
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment**:
   Create a `.env` file in the root directory:
   ```env
   GEMINI_API_KEY=your_api_key_here
   ```

4. **Run the application**:
   ```bash
   # Development mode (with hot reloading)
   npm run dev

   # Production mode
   npm run build
   npm start
   ```

### Docker Setup (Recommended)

1. **Ensure Docker and Docker Compose are installed**.
2. **Set your API key** in your shell or a `.env` file.
3. **Build and run**:
   ```bash
   docker-compose up --build
   ```
   The app will be available at `http://localhost:3000`.

## 🚢 Deployment

### GitHub Hosting / CI/CD
A GitHub Actions workflow is provided in `.github/workflows/deploy.yml`. 
- **Build**: It automatically builds the application on every push to `main`.
- **Deploy**: You can uncomment the deployment section in the workflow to deploy to Google Cloud Run or other platforms.

### Manual Cloud Run Deployment
To deploy to Google Cloud Run manually:
```bash
gcloud run deploy rag-chatbot --source . --env-vars GEMINI_API_KEY=your_key
```

## 📝 API Endpoints

### `POST /api/upload`
Uploads files and indexes them.
- **Body**: `multipart/form-data` with `files` field.

### `POST /api/chat`
Ask questions about your documents.
- **Request**: `{ "question": "...", "history": [...] }`
- **Response**: `{ "answer": "...", "sources": [...] }`

### `GET /api/documents`
Lists all indexed documents.

### `DELETE /api/documents/:id`
Deletes a document and its index.

---
*Built with ❤️ using Google AI Studio*
