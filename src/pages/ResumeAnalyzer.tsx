import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { toast } from "sonner";
import {
  ArrowLeft, Upload, FileText, AlertTriangle, CheckCircle2,
  Lightbulb, Target, Sparkles, BarChart3, Shield, Pen, Zap,
} from "lucide-react";

interface Improvement {
  severity: "critical" | "warning" | "tip";
  category: string;
  issue: string;
  suggestion: string;
}

interface Analysis {
  overall_score: number;
  ats_score: number;
  content_score: number;
  skills_score: number;
  presentation_score: number;
  summary: string;
  strengths: string[];
  improvements: Improvement[];
  missing_keywords: string[];
  detected_skills: string[];
}

const severityConfig = {
  critical: { icon: AlertTriangle, color: "text-destructive", bg: "bg-destructive/10", badge: "destructive" as const },
  warning: { icon: AlertTriangle, color: "text-amber-500", bg: "bg-amber-500/10", badge: "secondary" as const },
  tip: { icon: Lightbulb, color: "text-teal", bg: "bg-teal/10", badge: "outline" as const },
};

function ScoreRing({ score, label, size = "md" }: { score: number; label: string; size?: "sm" | "md" | "lg" }) {
  const sizes = { sm: 72, md: 100, lg: 140 };
  const s = sizes[size];
  const strokeWidth = size === "lg" ? 8 : 6;
  const radius = (s - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 80 ? "hsl(var(--success))" : score >= 60 ? "hsl(var(--amber))" : "hsl(var(--destructive))";

  return (
    <div className="flex flex-col items-center gap-1.5">
      <svg width={s} height={s} className="-rotate-90">
        <circle cx={s / 2} cy={s / 2} r={radius} fill="none" stroke="hsl(var(--border))" strokeWidth={strokeWidth} />
        <circle
          cx={s / 2} cy={s / 2} r={radius} fill="none" stroke={color}
          strokeWidth={strokeWidth} strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round" className="transition-all duration-1000 ease-out"
        />
        <text
          x={s / 2} y={s / 2}
          textAnchor="middle" dominantBaseline="central"
          className="fill-foreground rotate-90 origin-center"
          style={{ fontSize: size === "lg" ? 28 : size === "md" ? 20 : 16, fontWeight: 700 }}
        >
          {score}
        </text>
      </svg>
      <span className="text-xs text-muted-foreground font-medium text-center">{label}</span>
    </div>
  );
}

const ResumeAnalyzer = () => {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [targetRole, setTargetRole] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped && (dropped.type === "application/pdf" || dropped.type === "text/plain" || dropped.name.endsWith(".md"))) {
      setFile(dropped);
    } else {
      toast.error("Please upload a PDF, TXT, or MD file");
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) setFile(selected);
  };

  const analyzeResume = async () => {
    if (!file) return;
    setAnalyzing(true);
    setAnalysis(null);

    try {
      let resumeText = "";

      if (file.type === "application/pdf") {
        // Send PDF as base64 to edge function for server-side parsing
        const arrayBuffer = await file.arrayBuffer();
        const base64 = btoa(
          new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), "")
        );

        const resp = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-resume`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            },
            body: JSON.stringify({ pdfBase64: base64, targetRole: targetRole || undefined }),
          }
        );

        if (!resp.ok) {
          const errData = await resp.json();
          throw new Error(errData.error || "Analysis failed");
        }

        const result = await resp.json();
        setAnalysis(result.analysis);
        toast.success("Resume analysis complete!");
        return;
      } else {
        resumeText = await file.text();
      }

      if (!resumeText || resumeText.trim().length < 20) {
        throw new Error("Could not extract enough text from the file.");
      }

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-resume`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ resumeText, targetRole: targetRole || undefined }),
        }
      );

      if (!resp.ok) {
        const errData = await resp.json();
        throw new Error(errData.error || "Analysis failed");
      }

      const result = await resp.json();
      setAnalysis(result.analysis);
      toast.success("Resume analysis complete!");
    } catch (err: any) {
      console.error("Analysis error:", err);
      toast.error(err.message || "Failed to analyze resume");
    } finally {
      setAnalyzing(false);
    }
  };

  const criticalCount = analysis?.improvements.filter((i) => i.severity === "critical").length || 0;
  const warningCount = analysis?.improvements.filter((i) => i.severity === "warning").length || 0;
  const tipCount = analysis?.improvements.filter((i) => i.severity === "tip").length || 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-teal flex items-center justify-center">
              <FileText className="w-4 h-4 text-teal-foreground" />
            </div>
            <h1 className="font-display font-bold text-lg text-foreground">Resume Analyzer</h1>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        {/* Upload Section */}
        <Card className="p-6">
          <h2 className="font-display font-semibold text-lg text-card-foreground mb-4 flex items-center gap-2">
            <Upload className="w-5 h-5 text-teal" />
            Upload Your Resume
          </h2>

          <div
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
              dragOver ? "border-teal bg-teal/5" : "border-border hover:border-teal/50"
            }`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
          >
            {file ? (
              <div className="flex items-center justify-center gap-3">
                <FileText className="w-8 h-8 text-teal" />
                <div className="text-left">
                  <p className="font-medium text-card-foreground">{file.name}</p>
                  <p className="text-sm text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => { setFile(null); setAnalysis(null); }}>
                  Change
                </Button>
              </div>
            ) : (
              <>
                <Upload className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-card-foreground font-medium mb-1">Drop your resume here</p>
                <p className="text-sm text-muted-foreground mb-4">PDF, TXT, or MD files</p>
                <label>
                  <input type="file" accept=".pdf,.txt,.md" className="hidden" onChange={handleFileSelect} />
                  <Button variant="outline" size="sm" asChild><span>Browse Files</span></Button>
                </label>
              </>
            )}
          </div>

          <div className="mt-4 flex flex-col sm:flex-row gap-3">
            <Input
              placeholder="Target role (optional) — e.g. Senior Frontend Engineer"
              value={targetRole}
              onChange={(e) => setTargetRole(e.target.value)}
              className="flex-1"
            />
            <Button
              onClick={analyzeResume}
              disabled={!file || analyzing}
              className="bg-teal text-teal-foreground hover:bg-teal/90 font-display font-semibold"
            >
              {analyzing ? (
                <>
                  <Sparkles className="w-4 h-4 mr-2 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 mr-2" />
                  Analyze Resume
                </>
              )}
            </Button>
          </div>
        </Card>

        {/* Loading State */}
        {analyzing && (
          <Card className="p-8 text-center">
            <Sparkles className="w-12 h-12 text-teal mx-auto mb-4 animate-pulse" />
            <h3 className="font-display font-semibold text-lg text-card-foreground mb-2">
              Analyzing Your Resume...
            </h3>
            <p className="text-muted-foreground mb-4">
              Our AI is scoring your resume across ATS compatibility, content quality, skills, and presentation.
            </p>
            <Progress value={45} className="max-w-xs mx-auto" />
          </Card>
        )}

        {/* Results */}
        {analysis && (
          <>
            {/* Score Overview */}
            <Card className="p-6">
              <h2 className="font-display font-semibold text-lg text-card-foreground mb-6 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-teal" />
                Score Overview
              </h2>

              <div className="flex flex-col md:flex-row items-center gap-8">
                <ScoreRing score={analysis.overall_score} label="Overall" size="lg" />
                <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-6">
                  <ScoreRing score={analysis.ats_score} label="ATS" />
                  <ScoreRing score={analysis.content_score} label="Content" />
                  <ScoreRing score={analysis.skills_score} label="Skills" />
                  <ScoreRing score={analysis.presentation_score} label="Presentation" />
                </div>
              </div>

              <p className="mt-6 text-muted-foreground leading-relaxed bg-muted/50 rounded-lg p-4">
                {analysis.summary}
              </p>
            </Card>

            {/* Strengths */}
            <Card className="p-6">
              <h2 className="font-display font-semibold text-lg text-card-foreground mb-4 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-success" />
                Strengths
              </h2>
              <ul className="space-y-2">
                {analysis.strengths.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-card-foreground">
                    <CheckCircle2 className="w-4 h-4 text-success mt-0.5 shrink-0" />
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </Card>

            {/* Improvements */}
            <Card className="p-6">
              <h2 className="font-display font-semibold text-lg text-card-foreground mb-2 flex items-center gap-2">
                <Pen className="w-5 h-5 text-amber-500" />
                Improvements
              </h2>
              <div className="flex gap-3 mb-4">
                {criticalCount > 0 && (
                  <Badge variant="destructive">{criticalCount} Critical</Badge>
                )}
                {warningCount > 0 && (
                  <Badge variant="secondary">{warningCount} Warnings</Badge>
                )}
                {tipCount > 0 && (
                  <Badge variant="outline">{tipCount} Tips</Badge>
                )}
              </div>

              <Accordion type="multiple" className="space-y-2">
                {analysis.improvements.map((item, i) => {
                  const config = severityConfig[item.severity];
                  const Icon = config.icon;
                  return (
                    <AccordionItem key={i} value={`imp-${i}`} className={`${config.bg} rounded-lg border-none px-4`}>
                      <AccordionTrigger className="hover:no-underline py-3">
                        <div className="flex items-center gap-3 text-left">
                          <Icon className={`w-4 h-4 ${config.color} shrink-0`} />
                          <div>
                            <span className="text-sm font-medium text-card-foreground">{item.issue}</span>
                            <Badge variant={config.badge} className="ml-2 text-xs">{item.category}</Badge>
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="text-muted-foreground pb-3 pl-7">
                        {item.suggestion}
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            </Card>

            {/* Skills & Keywords */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="p-6">
                <h2 className="font-display font-semibold text-lg text-card-foreground mb-4 flex items-center gap-2">
                  <Shield className="w-5 h-5 text-teal" />
                  Detected Skills
                </h2>
                <div className="flex flex-wrap gap-2">
                  {analysis.detected_skills.map((skill) => (
                    <Badge key={skill} variant="secondary" className="bg-teal/10 text-teal border-teal/20">
                      {skill}
                    </Badge>
                  ))}
                </div>
              </Card>

              <Card className="p-6">
                <h2 className="font-display font-semibold text-lg text-card-foreground mb-4 flex items-center gap-2">
                  <Target className="w-5 h-5 text-amber-500" />
                  Missing Keywords
                </h2>
                {analysis.missing_keywords.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {analysis.missing_keywords.map((kw) => (
                      <Badge key={kw} variant="outline" className="border-amber-500/30 text-amber-600">
                        + {kw}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">Great coverage! No critical keywords missing.</p>
                )}
              </Card>
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default ResumeAnalyzer;
