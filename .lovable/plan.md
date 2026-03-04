

# RAG-Based Career Guidance with Pinecone, Redis, and Supabase

## Architecture

```text
User uploads PDF/text  →  Supabase Storage (raw files)
                          ↓
                    Edge Function: ingest-document
                          ↓
                    Parse + chunk text
                          ↓
                    Embed via Lovable AI (Gemini)
                          ↓
                    Store vectors in Pinecone
                    Store doc metadata in Supabase table
                          
User asks question  →  Edge Function: career-chat (updated)
                          ↓
                    Check Redis cache for similar query
                          ↓ (cache miss)
                    Embed query → Pinecone similarity search
                          ↓
                    Retrieve top-K chunks + metadata from Supabase
                          ↓
                    Cache results in Redis
                          ↓
                    Augment prompt with retrieved context → AI response
```

## Required Secrets

Before implementation, you'll need to provide:
1. **PINECONE_API_KEY** - from your Pinecone dashboard
2. **PINECONE_INDEX_URL** - your Pinecone index endpoint (e.g., `https://my-index-abc123.svc.pinecone.io`)
3. **REDIS_URL** - a Redis connection string (e.g., from Upstash, which works well with edge functions)

## Database Changes

**New table: `career_documents`**
- `id` (uuid, PK)
- `user_id` (uuid, nullable - null = global resource)
- `file_name` (text)
- `file_path` (text) - path in Supabase Storage
- `doc_type` (text) - e.g., "career_guide", "job_description", "industry_report"
- `chunk_count` (integer)
- `created_at` (timestamptz)

**New table: `document_chunks`**
- `id` (uuid, PK)
- `document_id` (uuid, FK → career_documents)
- `chunk_index` (integer)
- `content` (text)
- `pinecone_id` (text) - vector ID in Pinecone
- `metadata` (jsonb) - industry, role, skill_level tags

**New storage bucket: `career-documents`** (for uploaded PDFs/text files)

## Edge Functions

### 1. `ingest-document` (new)
- Receives uploaded file reference from storage
- Parses PDF/text content, splits into chunks (~500 tokens each)
- Calls Lovable AI gateway to generate embeddings (using Gemini embedding or a text model to produce summaries for search)
- Upserts vectors into Pinecone with metadata tags
- Stores chunk text + Pinecone IDs in `document_chunks` table
- Caches nothing here (write path)

### 2. `career-chat` (updated)
- Before calling the AI, generates an embedding of the user's query
- Checks Redis for cached results of similar queries
- On cache miss: queries Pinecone for top-5 relevant chunks
- Fetches full chunk content from `document_chunks`
- Injects retrieved context into the system prompt as grounding material
- Caches the query→chunks mapping in Redis (TTL ~1 hour)
- Proceeds with streaming response as before

## Frontend Changes

### Document Upload UI
- New `/knowledge-base` page with drag-and-drop file upload
- Supports PDF and text files
- Shows upload progress, processing status, and list of indexed documents
- Metadata tagging (industry, role, skill level) via dropdowns

### Chat Enhancement
- Show "Sources" accordion below AI responses listing which documents were referenced
- Small badge indicating "RAG-enhanced" when retrieved context was used

## Implementation Order

1. Collect API keys (Pinecone, Redis)
2. Create database tables and storage bucket
3. Build `ingest-document` edge function
4. Update `career-chat` edge function with RAG retrieval
5. Build document upload page
6. Update chat UI to show sources

