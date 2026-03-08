import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import {
  ArrowLeft, Mic, Sparkles, Send, CheckCircle2, Target,
  Lightbulb, BarChart3, RotateCcw, MessageSquare, Trophy,
} from "lucide-react";

interface InterviewQuestion {
  id: number;
  question: string;
  type: string;
  difficulty: string;
  hint: string;
}

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface Evaluation {
  overall_score: number;
  communication_score: number;
  technical_score: number;
  problem_solving_score: number;
  confidence_score: number;
  summary: string;
  strengths: string[];
  improvements: string[];
  tips: string[];
}

type Phase = "setup" | "interview" | "results";

const API_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mock-interview`;
const headers = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
};

function ScoreBar({ score, label }: { score: number; label: string }) {
  const color = score >= 80 ? "bg-success" : score >= 60 ? "bg-amber" : "bg-destructive";
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold text-card-foreground">{score}</span>
      </div>
      <div className="h-2 rounded-full bg-muted">
        <div className={`h-full rounded-full ${color} transition-all duration-700`} style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}

const MockInterview = () => {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>("setup");
  const [role, setRole] = useState("");
  const [experienceLevel, setExperienceLevel] = useState("mid-level");
  const [interviewType, setInterviewType] = useState("mixed");
  const [questionCount, setQuestionCount] = useState("5");
  const [loading, setLoading] = useState(false);

  const [questions, setQuestions] = useState<InterviewQuestion[]>([]);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [messages, setMessages] = useState<Message[]>([]);
  const [userInput, setUserInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [showHint, setShowHint] = useState(false);

  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const startInterview = async () => {
    if (!role.trim()) { toast.error("Please enter a target role"); return; }
    setLoading(true);
    try {
      const resp = await fetch(API_URL, {
        method: "POST", headers,
        body: JSON.stringify({ action: "generate_questions", role, experienceLevel, interviewType, questionCount: parseInt(questionCount) }),
      });
      if (!resp.ok) { const e = await resp.json(); throw new Error(e.error); }
      const data = await resp.json();
      setQuestions(data.questions);
      setCurrentQIndex(0);
      setMessages([{ role: "assistant", content: `Great, let's begin your mock interview for **${role}**. I'll ask you ${data.questions.length} questions.\n\n**Question 1 (${data.questions[0].type} — ${data.questions[0].difficulty}):**\n\n${data.questions[0].question}` }]);
      setPhase("interview");
    } catch (err: any) { toast.error(err.message); }
    finally { setLoading(false); }
  };

  const sendAnswer = async () => {
    if (!userInput.trim() || streaming) return;
    const answer = userInput.trim();
    setUserInput("");
    setShowHint(false);

    const userMsg: Message = { role: "user", content: answer };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setStreaming(true);

    const nextQIndex = currentQIndex + 1;
    const isLast = nextQIndex >= questions.length;

    // Build context for AI
    const contextMessages = [
      ...updatedMessages,
      ...(isLast ? [] : [{
        role: "user" as const,
        content: `[SYSTEM: The candidate just answered question ${currentQIndex + 1}. Give brief feedback, then ask question ${nextQIndex + 1}: "${questions[nextQIndex].question}" (${questions[nextQIndex].type}, ${questions[nextQIndex].difficulty})]`,
      }]),
      ...(isLast ? [{
        role: "user" as const,
        content: `[SYSTEM: The candidate just answered the last question. Give brief feedback on their answer, then wrap up the interview warmly. Say you'll now prepare their performance evaluation.]`,
      }] : []),
    ];

    try {
      const resp = await fetch(API_URL, {
        method: "POST", headers,
        body: JSON.stringify({ action: "chat", role, experienceLevel, messages: contextMessages }),
      });

      if (!resp.ok || !resp.body) throw new Error("Failed to get response");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              fullText += content;
              setMessages((prev) => {
                const last = prev[prev.length - 1];
                if (last?.role === "assistant" && prev.length > updatedMessages.length) {
                  return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: fullText } : m);
                }
                return [...prev, { role: "assistant", content: fullText }];
              });
            }
          } catch { buffer = line + "\n" + buffer; break; }
        }
      }

      if (!isLast) setCurrentQIndex(nextQIndex);
    } catch (err: any) {
      toast.error(err.message || "Failed to get interviewer response");
    } finally {
      setStreaming(false);
    }
  };

  const finishInterview = async () => {
    setLoading(true);
    try {
      const resp = await fetch(API_URL, {
        method: "POST", headers,
        body: JSON.stringify({ action: "evaluate", role, messages }),
      });
      if (!resp.ok) { const e = await resp.json(); throw new Error(e.error); }
      const data = await resp.json();
      setEvaluation(data.evaluation);
      setPhase("results");
    } catch (err: any) { toast.error(err.message); }
    finally { setLoading(false); }
  };

  const resetInterview = () => {
    setPhase("setup");
    setQuestions([]);
    setMessages([]);
    setEvaluation(null);
    setCurrentQIndex(0);
    setShowHint(false);
  };

  const currentQ = questions[currentQIndex];
  const isLastAnswered = currentQIndex >= questions.length - 1 && messages.filter(m => m.role === "user").length >= questions.length;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border bg-card">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Mic className="w-4 h-4 text-primary-foreground" />
            </div>
            <h1 className="font-display font-bold text-lg text-foreground">Mock Interview</h1>
          </div>
          {phase === "interview" && (
            <div className="ml-auto flex items-center gap-3">
              <span className="text-sm text-muted-foreground">Q{currentQIndex + 1}/{questions.length}</span>
              <Progress value={((currentQIndex + 1) / questions.length) * 100} className="w-24" />
            </div>
          )}
        </div>
      </header>

      <main className="flex-1 max-w-3xl w-full mx-auto px-6 py-8 flex flex-col">
        {/* Setup */}
        {phase === "setup" && (
          <Card className="p-8 max-w-lg mx-auto">
            <div className="text-center mb-6">
              <Mic className="w-12 h-12 text-teal mx-auto mb-3" />
              <h2 className="font-display font-bold text-xl text-card-foreground">Practice Interview</h2>
              <p className="text-muted-foreground mt-1">AI interviewer asks questions and gives real-time feedback</p>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-card-foreground mb-1.5 block">Target Role</label>
                <Input placeholder="e.g. Senior Frontend Engineer, Product Manager..." value={role} onChange={(e) => setRole(e.target.value)} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-sm font-medium text-card-foreground mb-1.5 block">Level</label>
                  <Select value={experienceLevel} onValueChange={setExperienceLevel}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="junior">Junior</SelectItem>
                      <SelectItem value="mid-level">Mid-Level</SelectItem>
                      <SelectItem value="senior">Senior</SelectItem>
                      <SelectItem value="lead">Lead/Staff</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium text-card-foreground mb-1.5 block">Type</label>
                  <Select value={interviewType} onValueChange={setInterviewType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mixed">Mixed</SelectItem>
                      <SelectItem value="behavioral">Behavioral</SelectItem>
                      <SelectItem value="technical">Technical</SelectItem>
                      <SelectItem value="system-design">System Design</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium text-card-foreground mb-1.5 block">Questions</label>
                  <Select value={questionCount} onValueChange={setQuestionCount}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="3">3</SelectItem>
                      <SelectItem value="5">5</SelectItem>
                      <SelectItem value="8">8</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={startInterview} disabled={!role.trim() || loading} className="w-full bg-teal text-teal-foreground hover:bg-teal/90 font-display font-semibold">
                {loading ? <><Sparkles className="w-4 h-4 mr-2 animate-spin" />Preparing Interview...</> : <><Mic className="w-4 h-4 mr-2" />Start Interview</>}
              </Button>
            </div>
          </Card>
        )}

        {/* Interview Chat */}
        {phase === "interview" && (
          <div className="flex-1 flex flex-col">
            <div className="flex-1 overflow-y-auto space-y-4 mb-4">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                    msg.role === "user"
                      ? "bg-teal text-teal-foreground rounded-br-md"
                      : "bg-card border border-border rounded-bl-md"
                  }`}>
                    {msg.role === "assistant" ? (
                      <div className="prose prose-sm max-w-none text-card-foreground">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    ) : (
                      <p>{msg.content}</p>
                    )}
                  </div>
                </div>
              ))}
              {streaming && (
                <div className="flex justify-start">
                  <div className="bg-card border border-border rounded-2xl rounded-bl-md px-4 py-3">
                    <Sparkles className="w-4 h-4 text-teal animate-pulse" />
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Hint */}
            {currentQ && showHint && (
              <div className="mb-3 p-3 rounded-lg bg-accent/10 border border-accent/20 text-sm">
                <p className="font-medium text-accent-foreground flex items-center gap-1">
                  <Lightbulb className="w-4 h-4" /> Hint
                </p>
                <p className="text-muted-foreground mt-1">{currentQ.hint}</p>
              </div>
            )}

            {/* Input Area */}
            <div className="border-t border-border pt-4">
              {isLastAnswered ? (
                <Button onClick={finishInterview} disabled={loading} className="w-full bg-teal text-teal-foreground hover:bg-teal/90 font-display font-semibold">
                  {loading ? <><Sparkles className="w-4 h-4 mr-2 animate-spin" />Evaluating...</> : <><Trophy className="w-4 h-4 mr-2" />Get Performance Review</>}
                </Button>
              ) : (
                <div className="flex gap-2">
                  {currentQ && !showHint && (
                    <Button variant="ghost" size="icon" onClick={() => setShowHint(true)} title="Show hint">
                      <Lightbulb className="w-4 h-4" />
                    </Button>
                  )}
                  <Textarea
                    placeholder="Type your answer..."
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendAnswer(); } }}
                    className="flex-1 min-h-[44px] max-h-[120px] resize-none"
                    disabled={streaming}
                  />
                  <Button onClick={sendAnswer} disabled={!userInput.trim() || streaming} size="icon" className="bg-teal text-teal-foreground hover:bg-teal/90 self-end">
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Results */}
        {phase === "results" && evaluation && (
          <div className="space-y-6">
            <Card className="p-8 text-center">
              <Trophy className="w-14 h-14 text-accent mx-auto mb-4" />
              <h2 className="font-display font-bold text-2xl text-card-foreground mb-1">Interview Complete!</h2>
              <div className="text-4xl font-display font-bold text-teal my-3">{evaluation.overall_score}/100</div>
              <p className="text-muted-foreground max-w-md mx-auto">{evaluation.summary}</p>
            </Card>

            <Card className="p-6">
              <h3 className="font-display font-semibold text-card-foreground mb-4 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-teal" /> Score Breakdown
              </h3>
              <div className="space-y-4">
                <ScoreBar score={evaluation.communication_score} label="Communication" />
                <ScoreBar score={evaluation.technical_score} label="Technical Knowledge" />
                <ScoreBar score={evaluation.problem_solving_score} label="Problem Solving" />
                <ScoreBar score={evaluation.confidence_score} label="Confidence" />
              </div>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="p-6">
                <h3 className="font-display font-semibold text-card-foreground mb-3 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-success" /> Strengths
                </h3>
                <ul className="space-y-2">
                  {evaluation.strengths.map((s, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-card-foreground">
                      <CheckCircle2 className="w-4 h-4 text-success mt-0.5 shrink-0" />{s}
                    </li>
                  ))}
                </ul>
              </Card>
              <Card className="p-6">
                <h3 className="font-display font-semibold text-card-foreground mb-3 flex items-center gap-2">
                  <Target className="w-5 h-5 text-amber" /> Areas to Improve
                </h3>
                <ul className="space-y-2">
                  {evaluation.improvements.map((w, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-card-foreground">
                      <Target className="w-4 h-4 text-amber mt-0.5 shrink-0" />{w}
                    </li>
                  ))}
                </ul>
              </Card>
            </div>

            {evaluation.tips.length > 0 && (
              <Card className="p-6">
                <h3 className="font-display font-semibold text-card-foreground mb-4 flex items-center gap-2">
                  <Lightbulb className="w-5 h-5 text-accent" /> Tips for Next Time
                </h3>
                <div className="space-y-3">
                  {evaluation.tips.map((tip, i) => (
                    <div key={i} className="p-3 rounded-lg bg-muted/50 text-sm text-card-foreground">{tip}</div>
                  ))}
                </div>
              </Card>
            )}

            <div className="flex gap-3 justify-center">
              <Button onClick={resetInterview} variant="outline" className="font-display">
                <RotateCcw className="w-4 h-4 mr-2" /> New Interview
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default MockInterview;
