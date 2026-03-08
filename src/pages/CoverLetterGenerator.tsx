import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import {
  ArrowLeft, FileText, Sparkles, Copy, Download, RefreshCw, Briefcase,
} from "lucide-react";

const CoverLetterGenerator = () => {
  const navigate = useNavigate();
  const [jobDescription, setJobDescription] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [roleName, setRoleName] = useState("");
  const [resumeText, setResumeText] = useState("");
  const [additionalNotes, setAdditionalNotes] = useState("");
  const [tone, setTone] = useState("professional");
  const [coverLetter, setCoverLetter] = useState("");
  const [generating, setGenerating] = useState(false);

  const generateCoverLetter = async () => {
    if (!jobDescription.trim()) {
      toast.error("Please paste a job description");
      return;
    }

    setGenerating(true);
    setCoverLetter("");

    try {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-cover-letter`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            jobDescription,
            companyName: companyName || undefined,
            roleName: roleName || undefined,
            resumeText: resumeText || undefined,
            additionalNotes: additionalNotes || undefined,
            tone,
          }),
        }
      );

      if (!resp.ok || !resp.body) {
        if (resp.status === 429) {
          toast.error("Rate limit exceeded. Please try again in a moment.");
          return;
        }
        if (resp.status === 402) {
          toast.error("Usage limit reached. Please add credits.");
          return;
        }
        const errData = await resp.json();
        throw new Error(errData.error || "Generation failed");
      }

      // Stream the response
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
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              fullText += content;
              setCoverLetter(fullText);
            }
          } catch {
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }

      toast.success("Cover letter generated!");
    } catch (err: any) {
      console.error("Generation error:", err);
      toast.error(err.message || "Failed to generate cover letter");
    } finally {
      setGenerating(false);
    }
  };

  const copyToClipboard = useCallback(() => {
    navigator.clipboard.writeText(coverLetter);
    toast.success("Copied to clipboard!");
  }, [coverLetter]);

  const downloadAsText = useCallback(() => {
    const blob = new Blob([coverLetter], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cover-letter-${companyName || "draft"}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [coverLetter, companyName]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
              <Briefcase className="w-4 h-4 text-accent-foreground" />
            </div>
            <h1 className="font-display font-bold text-lg text-foreground">Cover Letter Generator</h1>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Input Panel */}
          <div className="space-y-4">
            <Card className="p-6">
              <h2 className="font-display font-semibold text-lg text-card-foreground mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-teal" />
                Job Details
              </h2>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    placeholder="Company name"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                  />
                  <Input
                    placeholder="Role / Job title"
                    value={roleName}
                    onChange={(e) => setRoleName(e.target.value)}
                  />
                </div>

                <Textarea
                  placeholder="Paste the job description here..."
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  className="min-h-[160px] resize-none"
                />

                <Textarea
                  placeholder="Your background / resume summary (optional)"
                  value={resumeText}
                  onChange={(e) => setResumeText(e.target.value)}
                  className="min-h-[100px] resize-none"
                />

                <Textarea
                  placeholder="Additional notes — specific achievements, why you want this role, etc. (optional)"
                  value={additionalNotes}
                  onChange={(e) => setAdditionalNotes(e.target.value)}
                  className="min-h-[80px] resize-none"
                />

                <div className="flex items-center gap-3">
                  <Select value={tone} onValueChange={setTone}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Tone" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="professional">Professional</SelectItem>
                      <SelectItem value="conversational">Conversational</SelectItem>
                      <SelectItem value="enthusiastic">Enthusiastic</SelectItem>
                      <SelectItem value="formal">Formal</SelectItem>
                    </SelectContent>
                  </Select>

                  <Button
                    onClick={generateCoverLetter}
                    disabled={!jobDescription.trim() || generating}
                    className="flex-1 bg-teal text-teal-foreground hover:bg-teal/90 font-display font-semibold"
                  >
                    {generating ? (
                      <>
                        <Sparkles className="w-4 h-4 mr-2 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 mr-2" />
                        Generate Cover Letter
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </Card>
          </div>

          {/* Output Panel */}
          <div className="space-y-4">
            <Card className="p-6 min-h-[400px] flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display font-semibold text-lg text-card-foreground flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-accent" />
                  Generated Cover Letter
                </h2>
                {coverLetter && (
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={copyToClipboard}>
                      <Copy className="w-4 h-4 mr-1" />
                      Copy
                    </Button>
                    <Button variant="ghost" size="sm" onClick={downloadAsText}>
                      <Download className="w-4 h-4 mr-1" />
                      Download
                    </Button>
                    <Button variant="ghost" size="sm" onClick={generateCoverLetter} disabled={generating}>
                      <RefreshCw className="w-4 h-4 mr-1" />
                      Regenerate
                    </Button>
                  </div>
                )}
              </div>

              <div className="flex-1">
                {coverLetter ? (
                  <div className="prose prose-sm max-w-none text-card-foreground">
                    <ReactMarkdown>{coverLetter}</ReactMarkdown>
                  </div>
                ) : generating ? (
                  <div className="flex flex-col items-center justify-center h-full text-center py-12">
                    <Sparkles className="w-10 h-10 text-teal animate-pulse mb-4" />
                    <p className="text-muted-foreground font-medium">Crafting your cover letter...</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Tailoring content to the job description
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-center py-12">
                    <Briefcase className="w-10 h-10 text-muted-foreground/30 mb-4" />
                    <p className="text-muted-foreground font-medium">Your cover letter will appear here</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Fill in the job details and click Generate
                    </p>
                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};

export default CoverLetterGenerator;
