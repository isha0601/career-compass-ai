import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GENERATE_PROMPT = `You are an expert technical interviewer and skill assessor. Generate quiz questions to evaluate a candidate's proficiency in a specific skill.

You MUST respond by calling the "quiz_questions" tool with the results. Do not respond with plain text.

Guidelines:
- Generate questions that progress from beginner to advanced
- Include a mix of conceptual, practical, and scenario-based questions
- Each question should have 4 options with exactly 1 correct answer
- Provide a brief explanation for the correct answer
- Questions should test real-world understanding, not just memorization`;

const EVALUATE_PROMPT = `You are an expert skill assessor. Evaluate the user's quiz performance and provide a detailed proficiency assessment.

You MUST respond by calling the "quiz_evaluation" tool with the results. Do not respond with plain text.

Guidelines:
- Assess overall proficiency level (beginner/intermediate/advanced/expert)
- Identify specific strengths and weaknesses
- Provide actionable learning recommendations
- Be encouraging but honest`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, skill, difficulty, questionCount, answers, questions } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    if (action === "generate") {
      if (!skill || skill.trim().length < 2) {
        throw new Error("Please provide a skill to assess.");
      }

      const count = Math.min(questionCount || 5, 10);
      const userPrompt = `Generate ${count} quiz questions to assess proficiency in: "${skill}".\nDifficulty level: ${difficulty || "mixed (beginner to advanced)"}.\nMake questions progressively harder.`;

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: GENERATE_PROMPT },
            { role: "user", content: userPrompt },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "quiz_questions",
                description: "Return the generated quiz questions",
                parameters: {
                  type: "object",
                  properties: {
                    questions: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          id: { type: "number", description: "Question number starting from 1" },
                          question: { type: "string" },
                          options: {
                            type: "array",
                            items: { type: "string" },
                            description: "4 answer options",
                          },
                          correct_index: {
                            type: "number",
                            description: "0-based index of the correct option",
                          },
                          explanation: { type: "string", description: "Why this answer is correct" },
                          difficulty: { type: "string", enum: ["beginner", "intermediate", "advanced"] },
                        },
                        required: ["id", "question", "options", "correct_index", "explanation", "difficulty"],
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
          tool_choice: { type: "function", function: { name: "quiz_questions" } },
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again." }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        if (response.status === 402) {
          return new Response(JSON.stringify({ error: "Usage limit reached. Please add credits." }),
            { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        const t = await response.text();
        console.error("AI gateway error:", response.status, t);
        throw new Error("AI service temporarily unavailable");
      }

      const data = await response.json();
      const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
      if (!toolCall?.function?.arguments) throw new Error("AI did not return quiz questions");

      const result = JSON.parse(toolCall.function.arguments);
      return new Response(JSON.stringify({ success: true, ...result }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    } else if (action === "evaluate") {
      if (!answers || !questions) throw new Error("Missing answers or questions for evaluation");

      const summary = questions.map((q: any, i: number) => {
        const userAnswer = answers[i];
        const isCorrect = userAnswer === q.correct_index;
        return `Q${i + 1} (${q.difficulty}): ${q.question}\nUser answered: "${q.options[userAnswer] || 'skipped'}" — ${isCorrect ? "CORRECT" : `WRONG (correct: "${q.options[q.correct_index]}")`}`;
      }).join("\n\n");

      const correctCount = questions.filter((q: any, i: number) => answers[i] === q.correct_index).length;

      const userPrompt = `Skill: "${skill}"\nScore: ${correctCount}/${questions.length}\n\nDetailed results:\n${summary}`;

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: EVALUATE_PROMPT },
            { role: "user", content: userPrompt },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "quiz_evaluation",
                description: "Return the proficiency evaluation",
                parameters: {
                  type: "object",
                  properties: {
                    proficiency_level: { type: "string", enum: ["beginner", "intermediate", "advanced", "expert"] },
                    score_percentage: { type: "number" },
                    summary: { type: "string", description: "2-3 sentence assessment summary" },
                    strengths: { type: "array", items: { type: "string" } },
                    weaknesses: { type: "array", items: { type: "string" } },
                    recommendations: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          topic: { type: "string" },
                          suggestion: { type: "string" },
                        },
                        required: ["topic", "suggestion"],
                        additionalProperties: false,
                      },
                    },
                  },
                  required: ["proficiency_level", "score_percentage", "summary", "strengths", "weaknesses", "recommendations"],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: { type: "function", function: { name: "quiz_evaluation" } },
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          return new Response(JSON.stringify({ error: "Rate limit exceeded." }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        if (response.status === 402) {
          return new Response(JSON.stringify({ error: "Usage limit reached." }),
            { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        throw new Error("AI service temporarily unavailable");
      }

      const data = await response.json();
      const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
      if (!toolCall?.function?.arguments) throw new Error("AI did not return evaluation");

      const evaluation = JSON.parse(toolCall.function.arguments);
      return new Response(JSON.stringify({ success: true, evaluation }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    } else {
      throw new Error("Invalid action. Use 'generate' or 'evaluate'.");
    }
  } catch (e) {
    console.error("skill-quiz error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
