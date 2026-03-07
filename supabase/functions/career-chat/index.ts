import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are PathFinder AI, a personalized career guidance counselor. You are warm, insightful, and deeply knowledgeable about career development across industries.

Your capabilities:
1. **Profile Analysis**: Analyze the user's skills, education, experience, and career goals to understand their unique position.
2. **Skill Gap Identification**: Compare their current skills against requirements for their target roles and identify gaps.
3. **Career Path Recommendation**: Suggest realistic career paths with step-by-step roadmaps including timelines.
4. **Resource Suggestion**: Recommend specific courses, certifications, books, communities, and tools for skill development.
5. **Industry Insights**: Provide current market trends, salary ranges, demand levels, and growth projections for roles.

When a user first provides their profile, respond with a structured career guidance report:
- 🎯 **Career Assessment Summary**
- 📊 **Skill Gap Analysis** (table format with current level vs required level)
- 🗺️ **Recommended Career Paths** (2-3 paths with timelines)
- 📚 **Learning Roadmap** (prioritized resources)
- 💡 **Quick Wins** (things they can do this week)

For follow-up questions, provide focused, actionable answers. Always ground your advice in practical, real-world knowledge. Use specific company names, tools, certifications, and salary data when relevant.

Format responses with clear markdown headers, bullet points, and emphasis. Be encouraging but realistic.`;

async function getQueryEmbedding(text: string, apiKey: string): Promise<number[]> {
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
          content: "Extract 10 key terms from this text, comma-separated. Only output the terms, nothing else.",
        },
        { role: "user", content: text.slice(0, 2000) },
      ],
    }),
  });

  if (!response.ok) return [];

  const data = await response.json();
  const keywords = data.choices?.[0]?.message?.content || "";
  const combined = `${keywords} ${text.slice(0, 500)}`;
  const embedding = new Array(1024).fill(0);
  for (let i = 0; i < combined.length; i++) {
    embedding[i % 1024] += combined.charCodeAt(i) / 1000;
  }
  const magnitude = Math.sqrt(embedding.reduce((s: number, v: number) => s + v * v, 0));
  if (magnitude > 0) {
    for (let i = 0; i < embedding.length; i++) embedding[i] /= magnitude;
  }
  return embedding;
}

async function getCachedOrSearch(
  queryText: string,
  redisUrl: string,
  pineconeApiKey: string,
  pineconeIndexUrl: string,
  lovableApiKey: string,
  supabase: any
): Promise<{ chunks: any[]; cached: boolean }> {
  // Create a cache key from the query
  const cacheKey = `rag:${btoa(queryText.slice(0, 200)).replace(/[^a-zA-Z0-9]/g, "")}`;

  // Check Redis cache
  try {
    const redisResp = await fetch(`${redisUrl}/get/${cacheKey}`, {
      headers: { Authorization: `Bearer ${redisUrl.split("@")[0].split("//")[1]}` },
    });

    // Parse Upstash REST response
    if (redisResp.ok) {
      const redisData = await redisResp.json();
      if (redisData.result) {
        const cached = JSON.parse(redisData.result);
        if (cached && cached.length > 0) {
          console.log("Cache hit for query");
          return { chunks: cached, cached: true };
        }
      }
    }
  } catch (e) {
    console.log("Redis cache miss or error:", e);
  }

  // Generate embedding for query
  const embedding = await getQueryEmbedding(queryText, lovableApiKey);
  if (embedding.length === 0) return { chunks: [], cached: false };

  // Query Pinecone
  let matches: any[] = [];
  try {
    const pineconeResp = await fetch(`${pineconeIndexUrl}/query`, {
      method: "POST",
      headers: {
        "Api-Key": pineconeApiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        vector: embedding,
        topK: 5,
        includeMetadata: true,
      }),
    });

    if (pineconeResp.ok) {
      const pineconeData = await pineconeResp.json();
      matches = pineconeData.matches || [];
    }
  } catch (e) {
    console.error("Pinecone query error:", e);
  }

  if (matches.length === 0) return { chunks: [], cached: false };

  // Fetch chunk content from Supabase
  const pineconeIds = matches.map((m: any) => m.id);
  const { data: chunks } = await supabase
    .from("document_chunks")
    .select("content, pinecone_id, metadata, document_id")
    .in("pinecone_id", pineconeIds);

  const enrichedChunks = (chunks || []).map((chunk: any) => {
    const match = matches.find((m: any) => m.id === chunk.pinecone_id);
    return {
      ...chunk,
      score: match?.score || 0,
      file_name: match?.metadata?.file_name || "Unknown",
    };
  });

  // Cache in Redis (TTL 1 hour)
  try {
    await fetch(`${redisUrl}/set/${cacheKey}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${redisUrl.split("@")[0].split("//")[1]}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([JSON.stringify(enrichedChunks), "EX", 3600]),
    });
  } catch (e) {
    console.log("Redis cache write error:", e);
  }

  return { chunks: enrichedChunks, cached: false };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, profile } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const pineconeApiKey = Deno.env.get("PINECONE_API_KEY") || "";
    const pineconeIndexUrl = Deno.env.get("PINECONE_INDEX_URL") || "";
    const redisUrl = Deno.env.get("REDIS_URL") || "";

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Build messages with profile context
    const systemMessages: any[] = [{ role: "system", content: SYSTEM_PROMPT }];

    if (profile) {
      systemMessages.push({
        role: "system",
        content: `User Profile Context:\n- Name: ${profile.name || "Not provided"}\n- Current Role: ${profile.currentRole || "Not provided"}\n- Education: ${profile.education || "Not provided"}\n- Skills: ${profile.skills || "Not provided"}\n- Experience: ${profile.experience || "Not provided"}\n- Career Goals: ${profile.goals || "Not provided"}\n- Industries of Interest: ${profile.industries || "Not provided"}`,
      });
    }

    // RAG: Retrieve relevant context
    let ragSources: any[] = [];
    const lastUserMsg = [...messages].reverse().find((m: any) => m.role === "user");

    if (lastUserMsg && pineconeApiKey && pineconeIndexUrl) {
      try {
        const { chunks } = await getCachedOrSearch(
          lastUserMsg.content,
          redisUrl,
          pineconeApiKey,
          pineconeIndexUrl,
          LOVABLE_API_KEY,
          supabase
        );

        if (chunks.length > 0) {
          ragSources = chunks;
          const contextText = chunks
            .map((c: any, i: number) => `[Source ${i + 1}: ${c.file_name}]\n${c.content}`)
            .join("\n\n---\n\n");

          systemMessages.push({
            role: "system",
            content: `The following retrieved documents are relevant to the user's query. Use them to ground your response with specific, accurate information:\n\n${contextText}\n\nWhen using information from these sources, naturally reference them. If the sources don't contain relevant information, rely on your general knowledge.`,
          });
        }
      } catch (e) {
        console.error("RAG retrieval error:", e);
        // Continue without RAG context
      }
    }

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [...systemMessages, ...messages],
          stream: true,
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Usage limit reached. Please add credits to continue." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(
        JSON.stringify({ error: "AI service temporarily unavailable" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If we have RAG sources, prepend them as a custom SSE event before the stream
    if (ragSources.length > 0) {
      const sourcesEvent = `data: ${JSON.stringify({ sources: ragSources.map(s => ({ file_name: s.file_name, score: s.score, content_preview: s.content?.slice(0, 100) })) })}\n\n`;
      const sourcesEncoder = new TextEncoder();
      const sourcesChunk = sourcesEncoder.encode(sourcesEvent);

      const originalBody = response.body!;
      const { readable, writable } = new TransformStream();
      const writer = writable.getWriter();

      (async () => {
        await writer.write(sourcesChunk);
        const reader = originalBody.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          await writer.write(value);
        }
        await writer.close();
      })();

      return new Response(readable, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("career-chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
