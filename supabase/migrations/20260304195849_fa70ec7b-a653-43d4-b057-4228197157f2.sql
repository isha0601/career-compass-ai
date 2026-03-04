
-- Create career_documents table
CREATE TABLE public.career_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  doc_type TEXT NOT NULL DEFAULT 'career_guide',
  chunk_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create document_chunks table
CREATE TABLE public.document_chunks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES public.career_documents(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  pinecone_id TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX idx_document_chunks_document_id ON public.document_chunks(document_id);
CREATE INDEX idx_document_chunks_pinecone_id ON public.document_chunks(pinecone_id);
CREATE INDEX idx_career_documents_status ON public.career_documents(status);

-- Enable RLS
ALTER TABLE public.career_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_chunks ENABLE ROW LEVEL SECURITY;

-- RLS: Anyone can read documents (public knowledge base)
CREATE POLICY "Anyone can read documents" ON public.career_documents FOR SELECT USING (true);
CREATE POLICY "Anyone can insert documents" ON public.career_documents FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update documents" ON public.career_documents FOR UPDATE USING (true);

CREATE POLICY "Anyone can read chunks" ON public.document_chunks FOR SELECT USING (true);
CREATE POLICY "Service can insert chunks" ON public.document_chunks FOR INSERT WITH CHECK (true);

-- Create storage bucket for career documents
INSERT INTO storage.buckets (id, name, public) VALUES ('career-documents', 'career-documents', true);

-- Storage RLS policies
CREATE POLICY "Anyone can upload career docs" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'career-documents');
CREATE POLICY "Anyone can read career docs" ON storage.objects FOR SELECT USING (bucket_id = 'career-documents');
