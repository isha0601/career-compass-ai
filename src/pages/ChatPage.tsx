import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Send, Sparkles, User, Bot, Loader2, ArrowLeft, BookOpen, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import type { UserProfile } from "./ProfileSetup";

type RagSource = { file_name: string; score: number; content_preview: string };
type Msg = { role: "user" | "assistant"; content: string; sources?: RagSource[] };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/career-chat`;

const ChatPage = () => {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const profile: UserProfile | null = (() => {
    try {
      const saved = localStorage.getItem("career-profile");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  })();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (profile && messages.length === 0) {
      const initialMsg = `Hi! I'm ${profile.name}. Here's my profile:\n\n**Current Role:** ${profile.currentRole || "N/A"}\n**Education:** ${profile.education || "N/A"}\n**Skills:** ${profile.skills || "N/A"}\n**Experience:** ${profile.experience || "N/A"}\n**Career Goals:** ${profile.goals}\n**Industries:** ${profile.industries || "N/A"}\n\nPlease provide a comprehensive career guidance analysis based on my profile.`;
      sendMessage(initialMsg);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sendMessage = async (text: string) => {
    const userMsg: Msg = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    let assistantSoFar = "";
    let ragSources: RagSource[] = [];
    const allMessages = [...messages, userMsg].map(({ role, content }) => ({ role, content }));

    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: allMessages, profile: profile || undefined }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Request failed" }));
        if (resp.status === 429) toast.error("Rate limit exceeded. Please wait a moment.");
        else if (resp.status === 402) toast.error("Usage limit reached. Please add credits.");
        else toast.error(err.error || "Something went wrong");
        setIsLoading(false);
        return;
      }

      if (!resp.body) throw new Error("No response body");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let streamDone = false;

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") { streamDone = true; break; }

          try {
            const parsed = JSON.parse(jsonStr);

            // Check for RAG sources event
            if (parsed.sources) {
              ragSources = parsed.sources;
              continue;
            }

            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              assistantSoFar += content;
              setMessages((prev) => {
                const last = prev[prev.length - 1];
                if (last?.role === "assistant") {
                  return prev.map((m, i) =>
                    i === prev.length - 1
                      ? { ...m, content: assistantSoFar, sources: ragSources.length > 0 ? ragSources : undefined }
                      : m
                  );
                }
                return [...prev, { role: "assistant", content: assistantSoFar, sources: ragSources.length > 0 ? ragSources : undefined }];
              });
            }
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }

      // Final flush
      if (textBuffer.trim()) {
        for (let raw of textBuffer.split("\n")) {
          if (!raw) continue;
          if (raw.endsWith("\r")) raw = raw.slice(0, -1);
          if (raw.startsWith(":") || raw.trim() === "") continue;
          if (!raw.startsWith("data: ")) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === "[DONE]") continue;
          try {
            const parsed = JSON.parse(jsonStr);
            if (parsed.sources) { ragSources = parsed.sources; continue; }
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              assistantSoFar += content;
              setMessages((prev) => {
                const last = prev[prev.length - 1];
                if (last?.role === "assistant") {
                  return prev.map((m, i) =>
                    i === prev.length - 1
                      ? { ...m, content: assistantSoFar, sources: ragSources.length > 0 ? ragSources : undefined }
                      : m
                  );
                }
                return [...prev, { role: "assistant", content: assistantSoFar, sources: ragSources.length > 0 ? ragSources : undefined }];
              });
            }
          } catch { /* ignore */ }
        }
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to connect to AI. Please try again.");
    }

    setIsLoading(false);
  };

  const handleSubmit = () => {
    if (!input.trim() || isLoading) return;
    sendMessage(input.trim());
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const suggestedQuestions = [
    "What certifications would boost my career?",
    "What's the salary range for my target role?",
    "What projects should I build to stand out?",
    "How do I transition into a leadership role?",
  ];

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 sm:px-6 py-4 border-b border-border bg-card">
        <Button variant="ghost" size="icon" onClick={() => navigate("/")} className="shrink-0">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="w-8 h-8 rounded-lg bg-teal flex items-center justify-center">
          <Sparkles className="w-4 h-4 text-teal-foreground" />
        </div>
        <div>
          <h1 className="font-display font-semibold text-foreground text-sm">PathFinder AI</h1>
          <p className="text-xs text-muted-foreground">Career Guidance Assistant</p>
        </div>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" className="text-xs" onClick={() => navigate("/knowledge-base")}>
            <BookOpen className="w-3.5 h-3.5 mr-1" />
            Knowledge Base
          </Button>
          {profile && (
            <Button variant="outline" size="sm" className="text-xs" onClick={() => navigate("/profile")}>
              Edit Profile
            </Button>
          )}
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 space-y-6">
        {messages.length === 0 && !isLoading && (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <div className="w-16 h-16 rounded-2xl bg-teal/10 flex items-center justify-center mb-6 animate-pulse-glow">
              <Sparkles className="w-8 h-8 text-teal" />
            </div>
            <h2 className="font-display text-2xl font-bold text-foreground mb-2">Ready to Guide Your Career</h2>
            <p className="text-muted-foreground mb-8 max-w-md">
              {profile
                ? "Analyzing your profile... or ask me anything about your career!"
                : "Ask me anything about your career, or set up your profile for personalized guidance."}
            </p>
            {!profile && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-lg">
                {suggestedQuestions.map((q) => (
                  <button
                    key={q}
                    className="text-left px-4 py-3 rounded-lg border border-border bg-card text-sm text-foreground hover:bg-muted transition-colors"
                    onClick={() => sendMessage(q)}
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex gap-3 animate-fade-in ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {msg.role === "assistant" && (
              <div className="w-8 h-8 rounded-lg bg-teal/10 flex items-center justify-center shrink-0 mt-1">
                <Bot className="w-4 h-4 text-teal" />
              </div>
            )}
            <div className="max-w-[85%] sm:max-w-[75%] space-y-2">
              <div
                className={`rounded-2xl px-4 py-3 ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground rounded-br-sm"
                    : "bg-card border border-border text-card-foreground rounded-bl-sm"
                }`}
              >
                {msg.role === "assistant" ? (
                  <div className="prose prose-sm max-w-none text-card-foreground prose-headings:text-card-foreground prose-strong:text-card-foreground prose-a:text-teal">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                ) : (
                  <div className="text-sm whitespace-pre-wrap">{msg.content}</div>
                )}
              </div>

              {/* RAG Sources */}
              {msg.role === "assistant" && msg.sources && msg.sources.length > 0 && (
                <div className="ml-0">
                  <Badge variant="secondary" className="text-[10px] mb-1.5 bg-teal/10 text-teal border-teal/20">
                    RAG-Enhanced
                  </Badge>
                  <Collapsible>
                    <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                      <ChevronDown className="w-3 h-3" />
                      {msg.sources.length} source{msg.sources.length > 1 ? "s" : ""} referenced
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-1.5 space-y-1.5">
                      {msg.sources.map((src, j) => (
                        <div
                          key={j}
                          className="text-xs bg-muted/50 rounded-md px-3 py-2 border border-border"
                        >
                          <span className="font-medium text-foreground">{src.file_name}</span>
                          <span className="text-muted-foreground ml-2">
                            ({Math.round(src.score * 100)}% match)
                          </span>
                          {src.content_preview && (
                            <p className="text-muted-foreground mt-1 line-clamp-2">
                              {src.content_preview}...
                            </p>
                          )}
                        </div>
                      ))}
                    </CollapsibleContent>
                  </Collapsible>
                </div>
              )}
            </div>
            {msg.role === "user" && (
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-1">
                <User className="w-4 h-4 text-primary" />
              </div>
            )}
          </div>
        ))}

        {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
          <div className="flex gap-3 animate-fade-in">
            <div className="w-8 h-8 rounded-lg bg-teal/10 flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4 text-teal" />
            </div>
            <div className="bg-card border border-border rounded-2xl rounded-bl-sm px-4 py-3">
              <Loader2 className="w-4 h-4 animate-spin text-teal" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border bg-card px-4 sm:px-6 py-4">
        <div className="max-w-3xl mx-auto flex gap-3 items-end">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your career path..."
            rows={1}
            className="resize-none min-h-[44px] max-h-32 bg-background"
            disabled={isLoading}
          />
          <Button
            size="icon"
            className="bg-teal text-teal-foreground hover:bg-teal/90 shrink-0 h-11 w-11"
            onClick={handleSubmit}
            disabled={!input.trim() || isLoading}
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ChatPage;
