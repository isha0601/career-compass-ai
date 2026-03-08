import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const INTERVIEWER_SYSTEM = `You are an expert technical interviewer conducting a mock interview. You are warm but professional.

Your responsibilities:
- Ask one question at a time, progressing from behavioral to technical
- After the candidate answers, provide brief constructive feedback (2-3 sentences) then ask the next question
- Evaluate answers on: clarity, depth, relevance, and use of specific examples (STAR method for behavioral)
- When all questions are done, provide a comprehensive performance summary

IMPORTANT RULES:
- Never reveal you are AI — stay in character as an interviewer
- Keep feedback encouraging but honest
- If the candidate says "skip", move to the next question without judgment
- Format your responses clearly with markdown`;

const GENERATE_QUESTIONS_PROMPT = `You are an expert interview coach. Generate interview questions for a mock interview.

You MUST respond by calling the "interview_questions" tool. Do not respond with plain text.

Guidelines:
- Mix behavioral and technical questions appropriate for the role
- Progress from easier to harder
- Include at least 1 behavioral (STAR method), 1 situational, and role-specific technical questions
- Each question should have a brief hint about what a strong answer looks like`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, role, experienceLevel, interviewType, messages, questionCount } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    if (action === "generate_questions") {
      if (!role) throw new Error("Please specify a target role.");
      const count = Math.min(questionCount || 5, 8);

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: GENERATE_QUESTIONS_PROMPT },
            {
              role: "user",
              content: `Generate ${count} interview questions for: "${role}" (${experienceLevel || "mid-level"}). Interview type: ${interviewType || "mixed"}`,
            },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "interview_questions",
                description: "Return generated interview questions",
                parameters: {
                  type: "object",
                  properties: {
                    questions: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          id: { type: "number" },
                          question: { type: "string" },
                          type: { type: "string", enum: ["behavioral", "technical", "situational", "system-design"] },
                          difficulty: { type: "string", enum: ["easy", "medium", "hard"] },
                          hint: { type: "string", description: "Brief hint about what makes a strong answer" },
                        },
                        required: ["id", "question", "type", "difficulty", "hint"],
                        additionalProperties: false,
                      },
                    },
                  },
                  required: ["questions"],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: { type: "function", function: { name: "interview_questions" } },
        }),
      });

      if (!response.ok) {
        if (response.status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        if (response.status === 402) return new Response(JSON.stringify({ error: "Usage limit reached." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        throw new Error("AI service temporarily unavailable");
      }

      const data = await response.json();
      const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
      if (!toolCall?.function?.arguments) throw new Error("Failed to generate questions");

      return new Response(JSON.stringify({ success: true, ...JSON.parse(toolCall.function.arguments) }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    } else if (action === "chat") {
      if (!messages || !messages.length) throw new Error("No messages provided");

      const systemContent = `${INTERVIEWER_SYSTEM}\n\nYou are interviewing for the role: "${role || "Software Engineer"}" (${experienceLevel || "mid-level"}).`;

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: systemContent },
            ...messages,
          ],
          stream: true,
        }),
      });

      if (!response.ok) {
        if (response.status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        if (response.status === 402) return new Response(JSON.stringify({ error: "Usage limit reached." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        throw new Error("AI service temporarily unavailable");
      }

      return new Response(response.body, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });

    } else if (action === "evaluate") {
      if (!messages) throw new Error("No interview data provided");

      const evalPrompt = `Review the full mock interview conversation below for the role "${role || "Software Engineer"}". Provide a comprehensive evaluation.

You MUST respond by calling the "interview_evaluation" tool.`;

      const conversationText = messages
        .filter((m: any) => m.role !== "system")
        .map((m: any) => `${m.role === "user" ? "Candidate" : "Interviewer"}: ${m.content}`)
        .join("\n\n");

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: evalPrompt },
            { role: "user", content: conversationText },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "interview_evaluation",
                description: "Return the interview performance evaluation",
                parameters: {
                  type: "object",
                  properties: {
                    overall_score: { type: "number", description: "Score 0-100" },
                    communication_score: { type: "number" },
                    technical_score: { type: "number" },
                    problem_solving_score: { type: "number" },
                    confidence_score: { type: "number" },
                    summary: { type: "string" },
                    strengths: { type: "array", items: { type: "string" } },
                    improvements: { type: "array", items: { type: "string" } },
                    tips: { type: "array", items: { type: "string" }, description: "Actionable tips for next interviews" },
                  },
                  required: ["overall_score", "communication_score", "technical_score", "problem_solving_score", "confidence_score", "summary", "strengths", "improvements", "tips"],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: { type: "function", function: { name: "interview_evaluation" } },
        }),
      });

      if (!response.ok) {
        if (response.status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        if (response.status === 402) return new Response(JSON.stringify({ error: "Usage limit reached." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        throw new Error("AI service temporarily unavailable");
      }

      const data = await response.json();
      const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
      if (!toolCall?.function?.arguments) throw new Error("Failed to evaluate interview");

      return new Response(JSON.stringify({ success: true, evaluation: JSON.parse(toolCall.function.arguments) }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    } else {
      throw new Error("Invalid action.");
    }
  } catch (e) {
    console.error("mock-interview error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
