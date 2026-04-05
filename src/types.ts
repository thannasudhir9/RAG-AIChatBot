export interface DocumentChunk {
  id: string;
  documentId: string;
  filename: string;
  content: string;
  embedding: number[];
  metadata: {
    page?: number;
    section?: string;
    chunkIndex: number;
  };
}

export interface DocumentMetadata {
  id: string;
  filename: string;
  uploadDate: string;
  chunkCount: number;
  fileType: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  sources?: Source[];
}

export interface Source {
  filename: string;
  content: string;
  score: number;
}

export interface ChatResponse {
  answer: string;
  sources: Source[];
}
