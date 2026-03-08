import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are an expert career coach and professional cover letter writer. Generate a compelling, tailored cover letter based on the provided information.

Guidelines:
- Write in a professional yet personable tone
- Highlight relevant skills and experiences that match the job description
- Include specific examples and quantified achievements when possible
- Keep it concise (3-4 paragraphs)
- Address the hiring manager appropriately
- Show genuine enthusiasm for the role and company
- Avoid generic filler phrases
- Make it ATS-friendly with relevant keywords from the job description`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { jobDescription, companyName, roleName, resumeText, additionalNotes, tone } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    if (!jobDescription || jobDescription.trim().length < 20) {
      throw new Error("Please provide a job description (at least 20 characters).");
    }

    let userPrompt = `Generate a cover letter for the following position:\n\n`;
    if (companyName) userPrompt += `Company: ${companyName}\n`;
    if (roleName) userPrompt += `Role: ${roleName}\n`;
    if (tone) userPrompt += `Tone: ${tone}\n`;
    userPrompt += `\nJob Description:\n${jobDescription.slice(0, 4000)}\n`;
    if (resumeText) userPrompt += `\nCandidate's Background:\n${resumeText.slice(0, 4000)}\n`;
    if (additionalNotes) userPrompt += `\nAdditional Notes:\n${additionalNotes.slice(0, 1000)}\n`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        stream: true,
      }),
    });

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
      throw new Error("AI service temporarily unavailable");
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("generate-cover-letter error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
