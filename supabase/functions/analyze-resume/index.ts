import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ANALYSIS_PROMPT = `You are an expert ATS (Applicant Tracking System) analyzer and career coach. Analyze the provided resume and return a structured analysis.

You MUST respond by calling the "resume_analysis" tool with the results. Do not respond with plain text.

Evaluate the resume across these dimensions:
1. ATS Compatibility (formatting, keyword usage, structure)
2. Content Quality (achievements vs duties, quantified results, action verbs)
3. Skills Assessment (technical/soft skills coverage, relevance)
4. Overall Presentation (clarity, conciseness, professional tone)

For each issue found, classify severity as "critical", "warning", or "tip".`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { targetRole, resumeText: directText, pdfBase64 } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Build message content - either multimodal (PDF) or text
    let userContent: any;

    if (pdfBase64) {
      // Send PDF directly to Gemini as multimodal input
      const roleContext = targetRole
        ? `Analyze this resume for the target role: "${targetRole}"`
        : "Analyze this resume thoroughly.";

      userContent = [
        { type: "text", text: roleContext },
        {
          type: "image_url",
          image_url: {
            url: `data:application/pdf;base64,${pdfBase64}`,
          },
        },
      ];
    } else if (directText && directText.length >= 20) {
      const userPrompt = targetRole
        ? `Analyze this resume for the target role: "${targetRole}"\n\nResume:\n${directText.slice(0, 8000)}`
        : `Analyze this resume:\n\n${directText.slice(0, 8000)}`;
      userContent = userPrompt;
    } else {
      throw new Error("No resume content provided. Please upload a PDF or text file.");
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: ANALYSIS_PROMPT },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "resume_analysis",
              description: "Return the structured resume analysis results",
              parameters: {
                type: "object",
                properties: {
                  overall_score: {
                    type: "number",
                    description: "Overall resume score from 0-100",
                  },
                  ats_score: {
                    type: "number",
                    description: "ATS compatibility score from 0-100",
                  },
                  content_score: {
                    type: "number",
                    description: "Content quality score from 0-100",
                  },
                  skills_score: {
                    type: "number",
                    description: "Skills assessment score from 0-100",
                  },
                  presentation_score: {
                    type: "number",
                    description: "Presentation score from 0-100",
                  },
                  summary: {
                    type: "string",
                    description: "2-3 sentence executive summary of the resume quality",
                  },
                  strengths: {
                    type: "array",
                    items: { type: "string" },
                    description: "List of resume strengths (3-5 items)",
                  },
                  improvements: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        severity: { type: "string", enum: ["critical", "warning", "tip"] },
                        category: { type: "string" },
                        issue: { type: "string" },
                        suggestion: { type: "string" },
                      },
                      required: ["severity", "category", "issue", "suggestion"],
                    },
                    description: "List of improvement suggestions",
                  },
                  missing_keywords: {
                    type: "array",
                    items: { type: "string" },
                    description: "Keywords that should be added for the target role",
                  },
                  detected_skills: {
                    type: "array",
                    items: { type: "string" },
                    description: "Skills detected in the resume",
                  },
                },
                required: [
                  "overall_score", "ats_score", "content_score", "skills_score",
                  "presentation_score", "summary", "strengths", "improvements",
                  "missing_keywords", "detected_skills",
                ],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "resume_analysis" } },
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

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      throw new Error("AI did not return structured analysis");
    }

    const analysis = JSON.parse(toolCall.function.arguments);

    return new Response(
      JSON.stringify({ success: true, analysis }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("analyze-resume error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
