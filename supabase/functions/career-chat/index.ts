import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, profile } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Build messages with profile context if provided
    const systemMessages = [{ role: "system", content: SYSTEM_PROMPT }];
    
    if (profile) {
      systemMessages.push({
        role: "system",
        content: `User Profile Context:\n- Name: ${profile.name || "Not provided"}\n- Current Role: ${profile.currentRole || "Not provided"}\n- Education: ${profile.education || "Not provided"}\n- Skills: ${profile.skills || "Not provided"}\n- Experience: ${profile.experience || "Not provided"}\n- Career Goals: ${profile.goals || "Not provided"}\n- Industries of Interest: ${profile.industries || "Not provided"}`,
      });
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
