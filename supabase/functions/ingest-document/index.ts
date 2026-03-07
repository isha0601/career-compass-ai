import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function chunkText(text: string, maxTokens = 500): string[] {
  const sentences = text.split(/(?<=[.!?])\s+/);
  const chunks: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    const combined = current ? `${current} ${sentence}` : sentence;
    // Rough token estimate: ~4 chars per token
    if (combined.length / 4 > maxTokens && current) {
      chunks.push(current.trim());
      current = sentence;
    } else {
      current = combined;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createDeterministicEmbedding(text: string): number[] {
  const embedding = new Array(1536).fill(0);
  for (let i = 0; i < text.length; i++) {
    embedding[i % 1536] += text.charCodeAt(i) / 1000;
  }

  const magnitude = Math.sqrt(embedding.reduce((s, v) => s + v * v, 0));
  if (magnitude > 0) {
    for (let i = 0; i < embedding.length; i++) embedding[i] /= magnitude;
  }

  return embedding;
}

async function extractDocumentKeywords(text: string, apiKey: string, retries = 5): Promise<string> {
  for (let attempt = 0; attempt < retries; attempt++) {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          {
            role: "system",
            content: "Extract 20 key terms from this document, comma-separated. Only output the terms.",
          },
          { role: "user", content: text.slice(0, 6000) },
        ],
      }),
    });

    if (response.status === 429) {
      const wait = Math.pow(2, attempt) * 2500;
      console.log(`Rate limited while extracting document keywords (attempt ${attempt + 1}), waiting ${wait}ms...`);
      await response.text();
      await sleep(wait);
      continue;
    }

    if (!response.ok) {
      throw new Error(`Keyword extraction failed: ${response.status}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || "";
  }

  throw new Error("Keyword extraction failed: rate limited after retries");
}



serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  let documentId: string | undefined;

  try {
    const payload = await req.json();
    documentId = payload?.documentId;
    const { filePath, fileName, docType, metadata } = payload;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const pineconeApiKey = Deno.env.get("PINECONE_API_KEY")!;
    const pineconeIndexUrl = Deno.env.get("PINECONE_INDEX_URL")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Update status to processing
    await supabase
      .from("career_documents")
      .update({ status: "processing" })
      .eq("id", documentId);

    // Download file from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("career-documents")
      .download(filePath);

    if (downloadError || !fileData) {
      throw new Error(`Failed to download file: ${downloadError?.message}`);
    }

    // Extract text content
    let textContent: string;
    if (fileName.endsWith(".pdf")) {
      // For PDF, extract raw text (basic approach - reads as text)
      // In production, use a PDF parsing library
      textContent = await fileData.text();
      // Clean up PDF binary artifacts
      textContent = textContent.replace(/[^\x20-\x7E\n\r\t]/g, " ").replace(/\s+/g, " ").trim();
    } else {
      textContent = await fileData.text();
    }

    if (!textContent || textContent.length < 10) {
      throw new Error("Could not extract meaningful text from file");
    }

    // Chunk the text
    const chunks = chunkText(textContent);
    console.log(`Split into ${chunks.length} chunks`);

    // Extract keywords ONCE per document, then build deterministic chunk embeddings
    const documentKeywords = await extractDocumentKeywords(textContent, lovableApiKey);

    // Process each chunk: embed and store
    const pineconeVectors: any[] = [];
    const chunkRecords: any[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunkContent = chunks[i];
      const pineconeId = `${documentId}_chunk_${i}`;
      const combinedForEmbedding = `${documentKeywords} ${chunkContent.slice(0, 700)}`;
      const embedding = createDeterministicEmbedding(combinedForEmbedding);

      pineconeVectors.push({
        id: pineconeId,
        values: embedding,
        metadata: {
          document_id: documentId,
          chunk_index: i,
          doc_type: docType || "career_guide",
          file_name: fileName,
          ...(metadata || {}),
        },
      });

      chunkRecords.push({
        document_id: documentId,
        chunk_index: i,
        content: chunkContent,
        pinecone_id: pineconeId,
        metadata: metadata || {},
      });
    }

    // Upsert vectors to Pinecone (batch of 100)
    for (let i = 0; i < pineconeVectors.length; i += 100) {
      const batch = pineconeVectors.slice(i, i + 100);
      const pineconeResp = await fetch(`${pineconeIndexUrl}/vectors/upsert`, {
        method: "POST",
        headers: {
          "Api-Key": pineconeApiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ vectors: batch }),
      });

      if (!pineconeResp.ok) {
        const errText = await pineconeResp.text();
        console.error("Pinecone upsert error:", errText);
        throw new Error(`Pinecone upsert failed: ${pineconeResp.status}`);
      }
    }

    // Store chunks in Supabase
    const { error: chunksError } = await supabase
      .from("document_chunks")
      .insert(chunkRecords);

    if (chunksError) {
      throw new Error(`Failed to store chunks: ${chunksError.message}`);
    }

    // Update document status
    await supabase
      .from("career_documents")
      .update({ status: "indexed", chunk_count: chunks.length })
      .eq("id", documentId);

    return new Response(
      JSON.stringify({ success: true, chunkCount: chunks.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("ingest-document error:", e);

    // Try to update document status to failed
    try {
      if (documentId) {
        const supabase = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );
        await supabase
          .from("career_documents")
          .update({ status: "failed" })
          .eq("id", documentId);
      }
    } catch {}

    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
