# PathFinder AI — Personalized Career Guidance Platform

An AI-powered career guidance web application that provides personalized skill analysis, interview coaching, resume review, and career planning — all in one place.

## 🎯 Overview

PathFinder AI acts as a 24/7 career counselor, helping students, job seekers, and professionals navigate their career journey. It combines multiple AI-driven tools into a single platform, using Retrieval-Augmented Generation (RAG) to deliver context-aware, personalized advice grounded in real career resources.

## ✨ Features

### AI Career Chat
Conversational AI assistant specialized in career guidance. Ask about career paths, skill development, salary expectations, or industry trends. Responses are enhanced with context from uploaded career documents (RAG).

### Resume Analyzer
Upload your resume and receive detailed AI feedback on structure, content, keyword optimization, and areas for improvement — tailored to your target role.

### Cover Letter Generator
Paste a job description and your background. The AI generates a polished, role-specific cover letter with customizable tone (professional, conversational, enthusiastic, formal).

### Skill Assessment Quiz
Select any skill (React, Python, Data Science, etc.) and take an AI-generated quiz. Get instant feedback with explanations for each question to identify knowledge gaps.

### Mock Interview Coach
Practice interviews with an AI interviewer that adapts to your target role and experience level. Receive real-time feedback and a detailed performance scorecard covering communication, technical knowledge, problem-solving, and confidence.

### Knowledge Base (RAG)
Upload career guides, job descriptions, and industry reports. Documents are chunked, embedded, and indexed so the AI chat can retrieve relevant context when answering your questions.

### Profile Setup
Enter your skills, education, experience, and career goals to receive personalized recommendations across all features.

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────┐
│                   React Frontend                     │
│  (TypeScript + Tailwind CSS + shadcn/ui)            │
├─────────────────────────────────────────────────────┤
│                                                      │
│  Index ── Chat ── Resume Analyzer ── Cover Letter    │
│           │       Skill Quiz ── Mock Interview        │
│           │       Knowledge Base ── Profile Setup     │
│           │                                          │
├───────────┼──────────────────────────────────────────┤
│           ▼                                          │
│     Lovable Cloud (Supabase)                         │
│  ┌─────────────────────────────────────────────┐     │
│  │  Edge Functions (Serverless)                │     │
│  │  ├── career-chat        (RAG + streaming)   │     │
│  │  ├── analyze-resume     (streaming)         │     │
│  │  ├── generate-cover-letter (streaming)      │     │
│  │  ├── skill-quiz         (question gen)      │     │
│  │  ├── mock-interview     (multi-action)      │     │
│  │  └── ingest-document    (chunking + embed)  │     │
│  ├─────────────────────────────────────────────┤     │
│  │  Database (PostgreSQL)                      │     │
│  │  ├── career_documents   (doc metadata)      │     │
│  │  └── document_chunks    (text chunks)       │     │
│  ├─────────────────────────────────────────────┤     │
│  │  Storage                                    │     │
│  │  └── career-documents bucket (PDF/text)     │     │
│  └─────────────────────────────────────────────┘     │
│           │                                          │
│           ▼                                          │
│     Lovable AI Gateway                               │
│     (Google Gemini models — no API key required)     │
└─────────────────────────────────────────────────────┘
```

### RAG Pipeline

1. **Ingest** — User uploads a document → Edge Function parses and chunks the text → Embeddings generated via AI → Vectors stored in Pinecone, text stored in database
2. **Query** — User asks a question → Query is embedded → Pinecone similarity search finds relevant chunks → Chunks injected into AI prompt as context → Grounded response streamed back

### Data Flow

- All AI responses use **Server-Sent Events (SSE)** for real-time streaming
- Edge Functions act as the middleware between the frontend and AI models
- Database stores document metadata and chunk content for retrieval
- Redis caching (optional) reduces redundant vector lookups

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18, TypeScript, Vite |
| **Styling** | Tailwind CSS, shadcn/ui, Lucide Icons |
| **State** | TanStack React Query, React Hook Form |
| **Backend** | Lovable Cloud (Supabase Edge Functions, PostgreSQL, Storage) |
| **AI Models** | Google Gemini (via Lovable AI Gateway) |
| **Vector DB** | Pinecone (for RAG embeddings) |
| **Caching** | Redis / Upstash (for query caching) |
| **Routing** | React Router v6 |

## 📁 Project Structure

```
src/
├── components/
│   └── ui/              # shadcn/ui component library
├── hooks/               # Custom React hooks
├── integrations/
│   └── supabase/        # Auto-generated client & types
├── pages/
│   ├── Index.tsx         # Landing page
│   ├── ChatPage.tsx      # AI career chat
│   ├── ResumeAnalyzer.tsx
│   ├── CoverLetterGenerator.tsx
│   ├── SkillQuiz.tsx
│   ├── MockInterview.tsx
│   ├── KnowledgeBase.tsx
│   └── ProfileSetup.tsx
└── lib/                 # Utilities

supabase/
├── functions/
│   ├── career-chat/
│   ├── analyze-resume/
│   ├── generate-cover-letter/
│   ├── skill-quiz/
│   ├── mock-interview/
│   └── ingest-document/
└── config.toml
```

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) 18+
- A [Lovable](https://lovable.dev) account (for Cloud backend)

### Local Development

```bash
# Clone the repository
git clone <your-repo-url>
cd pathfinder-ai

# Install dependencies
npm install

# Start development server
npm run dev
```

The app will be available at `http://localhost:5173`.

### Environment Variables

The following are auto-configured by Lovable Cloud:
- `VITE_SUPABASE_URL` — Backend API endpoint
- `VITE_SUPABASE_PUBLISHABLE_KEY` — Public API key

### Optional Secrets (for RAG features)

Configure these in Lovable Cloud settings:
- `PINECONE_API_KEY` — For vector similarity search
- `PINECONE_INDEX_URL` — Your Pinecone index endpoint
- `REDIS_URL` — Redis connection string (e.g., Upstash)

## 📄 License

This project is built with [Lovable](https://lovable.dev).
