import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  ArrowLeft, Brain, Sparkles, CheckCircle2, XCircle,
  ArrowRight, Trophy, Target, Lightbulb, RotateCcw,
} from "lucide-react";

interface QuizQuestion {
  id: number;
  question: string;
  options: string[];
  correct_index: number;
  explanation: string;
  difficulty: "beginner" | "intermediate" | "advanced";
}

interface Evaluation {
  proficiency_level: string;
  score_percentage: number;
  summary: string;
  strengths: string[];
  weaknesses: string[];
  recommendations: { topic: string; suggestion: string }[];
}

type Phase = "setup" | "quiz" | "results";

const difficultyColors = {
  beginner: "bg-success/10 text-success border-success/20",
  intermediate: "bg-amber/10 text-amber border-amber/20",
  advanced: "bg-destructive/10 text-destructive border-destructive/20",
};

const levelConfig: Record<string, { color: string; label: string }> = {
  beginner: { color: "text-amber", label: "🌱 Beginner" },
  intermediate: { color: "text-teal", label: "📈 Intermediate" },
  advanced: { color: "text-success", label: "🚀 Advanced" },
  expert: { color: "text-accent", label: "⭐ Expert" },
};

const SkillQuiz = () => {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>("setup");
  const [skill, setSkill] = useState("");
  const [difficulty, setDifficulty] = useState("mixed");
  const [questionCount, setQuestionCount] = useState("5");
  const [loading, setLoading] = useState(false);

  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [showExplanation, setShowExplanation] = useState(false);

  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);

  const callQuizApi = async (body: any) => {
    const resp = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/skill-quiz`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify(body),
      }
    );
    if (!resp.ok) {
      const err = await resp.json();
      throw new Error(err.error || "Request failed");
    }
    return resp.json();
  };

  const startQuiz = async () => {
    if (!skill.trim()) {
      toast.error("Please enter a skill to assess");
      return;
    }
    setLoading(true);
    try {
      const data = await callQuizApi({
        action: "generate",
        skill,
        difficulty: difficulty === "mixed" ? undefined : difficulty,
        questionCount: parseInt(questionCount),
      });
      setQuestions(data.questions);
      setCurrentIndex(0);
      setAnswers({});
      setShowExplanation(false);
      setEvaluation(null);
      setPhase("quiz");
      toast.success(`${data.questions.length} questions generated!`);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const selectAnswer = (optionIndex: number) => {
    if (answers[currentIndex] !== undefined) return;
    setAnswers((prev) => ({ ...prev, [currentIndex]: optionIndex }));
    setShowExplanation(true);
  };

  const nextQuestion = () => {
    setShowExplanation(false);
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((i) => i + 1);
    }
  };

  const finishQuiz = async () => {
    setLoading(true);
    try {
      const data = await callQuizApi({
        action: "evaluate",
        skill,
        questions,
        answers: questions.map((_, i) => answers[i] ?? -1),
      });
      setEvaluation(data.evaluation);
      setPhase("results");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const resetQuiz = () => {
    setPhase("setup");
    setQuestions([]);
    setAnswers({});
    setEvaluation(null);
    setCurrentIndex(0);
    setShowExplanation(false);
  };

  const currentQ = questions[currentIndex];
  const answeredCount = Object.keys(answers).length;
  const correctCount = questions.filter((q, i) => answers[i] === q.correct_index).length;
  const isLastQuestion = currentIndex === questions.length - 1;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center">
              <Brain className="w-4 h-4 text-secondary-foreground" />
            </div>
            <h1 className="font-display font-bold text-lg text-foreground">Skill Assessment</h1>
          </div>
          {phase === "quiz" && (
            <div className="ml-auto flex items-center gap-3">
              <span className="text-sm text-muted-foreground">
                {currentIndex + 1} / {questions.length}
              </span>
              <Progress value={((currentIndex + 1) / questions.length) * 100} className="w-24" />
            </div>
          )}
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8">
        {/* Setup Phase */}
        {phase === "setup" && (
          <Card className="p-8 max-w-lg mx-auto">
            <div className="text-center mb-6">
              <Brain className="w-12 h-12 text-teal mx-auto mb-3" />
              <h2 className="font-display font-bold text-xl text-card-foreground">Test Your Skills</h2>
              <p className="text-muted-foreground mt-1">
                AI generates adaptive questions to evaluate your proficiency
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-card-foreground mb-1.5 block">Skill to Assess</label>
                <Input
                  placeholder="e.g. React, Python, Machine Learning, SQL..."
                  value={skill}
                  onChange={(e) => setSkill(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-card-foreground mb-1.5 block">Difficulty</label>
                  <Select value={difficulty} onValueChange={setDifficulty}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mixed">Mixed (Adaptive)</SelectItem>
                      <SelectItem value="beginner">Beginner</SelectItem>
                      <SelectItem value="intermediate">Intermediate</SelectItem>
                      <SelectItem value="advanced">Advanced</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium text-card-foreground mb-1.5 block">Questions</label>
                  <Select value={questionCount} onValueChange={setQuestionCount}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="3">3 Questions</SelectItem>
                      <SelectItem value="5">5 Questions</SelectItem>
                      <SelectItem value="8">8 Questions</SelectItem>
                      <SelectItem value="10">10 Questions</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button
                onClick={startQuiz}
                disabled={!skill.trim() || loading}
                className="w-full bg-teal text-teal-foreground hover:bg-teal/90 font-display font-semibold"
              >
                {loading ? (
                  <><Sparkles className="w-4 h-4 mr-2 animate-spin" />Generating Quiz...</>
                ) : (
                  <><Sparkles className="w-4 h-4 mr-2" />Start Assessment</>
                )}
              </Button>
            </div>
          </Card>
        )}

        {/* Quiz Phase */}
        {phase === "quiz" && currentQ && (
          <div className="space-y-6">
            <Card className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <Badge variant="outline" className={difficultyColors[currentQ.difficulty]}>
                  {currentQ.difficulty}
                </Badge>
                <span className="text-sm text-muted-foreground">Question {currentIndex + 1}</span>
              </div>

              <h2 className="font-display font-semibold text-lg text-card-foreground mb-6">
                {currentQ.question}
              </h2>

              <div className="space-y-3">
                {currentQ.options.map((option, i) => {
                  const answered = answers[currentIndex] !== undefined;
                  const isSelected = answers[currentIndex] === i;
                  const isCorrect = currentQ.correct_index === i;

                  let optionClass = "border-border hover:border-teal/50 hover:bg-teal/5 cursor-pointer";
                  if (answered) {
                    if (isCorrect) {
                      optionClass = "border-success bg-success/10";
                    } else if (isSelected && !isCorrect) {
                      optionClass = "border-destructive bg-destructive/10";
                    } else {
                      optionClass = "border-border opacity-50";
                    }
                  }

                  return (
                    <button
                      key={i}
                      onClick={() => selectAnswer(i)}
                      disabled={answered}
                      className={`w-full text-left p-4 rounded-xl border-2 transition-all flex items-center gap-3 ${optionClass}`}
                    >
                      <span className="w-8 h-8 rounded-full border-2 border-current flex items-center justify-center text-sm font-semibold shrink-0">
                        {String.fromCharCode(65 + i)}
                      </span>
                      <span className="text-card-foreground">{option}</span>
                      {answered && isCorrect && (
                        <CheckCircle2 className="w-5 h-5 text-success ml-auto shrink-0" />
                      )}
                      {answered && isSelected && !isCorrect && (
                        <XCircle className="w-5 h-5 text-destructive ml-auto shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>

              {showExplanation && (
                <div className="mt-4 p-4 rounded-lg bg-muted/50 border border-border">
                  <p className="text-sm font-medium text-card-foreground mb-1">Explanation</p>
                  <p className="text-sm text-muted-foreground">{currentQ.explanation}</p>
                </div>
              )}
            </Card>

            <div className="flex justify-between">
              <div className="text-sm text-muted-foreground">
                {correctCount} / {answeredCount} correct so far
              </div>
              {answers[currentIndex] !== undefined && (
                isLastQuestion ? (
                  <Button
                    onClick={finishQuiz}
                    disabled={loading}
                    className="bg-teal text-teal-foreground hover:bg-teal/90 font-display font-semibold"
                  >
                    {loading ? (
                      <><Sparkles className="w-4 h-4 mr-2 animate-spin" />Evaluating...</>
                    ) : (
                      <><Trophy className="w-4 h-4 mr-2" />See Results</>
                    )}
                  </Button>
                ) : (
                  <Button onClick={nextQuestion} variant="outline" className="font-display">
                    Next <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                )
              )}
            </div>
          </div>
        )}

        {/* Results Phase */}
        {phase === "results" && evaluation && (
          <div className="space-y-6">
            {/* Score Card */}
            <Card className="p-8 text-center">
              <Trophy className="w-14 h-14 text-accent mx-auto mb-4" />
              <h2 className="font-display font-bold text-2xl text-card-foreground mb-1">
                {correctCount} / {questions.length} Correct
              </h2>
              <p className="text-lg font-display font-semibold mb-2">
                <span className={levelConfig[evaluation.proficiency_level]?.color || "text-foreground"}>
                  {levelConfig[evaluation.proficiency_level]?.label || evaluation.proficiency_level}
                </span>
              </p>
              <Progress value={evaluation.score_percentage} className="max-w-xs mx-auto mb-4" />
              <p className="text-muted-foreground max-w-md mx-auto">{evaluation.summary}</p>
            </Card>

            {/* Strengths & Weaknesses */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="p-6">
                <h3 className="font-display font-semibold text-card-foreground mb-3 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-success" />
                  Strengths
                </h3>
                <ul className="space-y-2">
                  {evaluation.strengths.map((s, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-card-foreground">
                      <CheckCircle2 className="w-4 h-4 text-success mt-0.5 shrink-0" />
                      {s}
                    </li>
                  ))}
                </ul>
              </Card>

              <Card className="p-6">
                <h3 className="font-display font-semibold text-card-foreground mb-3 flex items-center gap-2">
                  <Target className="w-5 h-5 text-amber" />
                  Areas to Improve
                </h3>
                <ul className="space-y-2">
                  {evaluation.weaknesses.map((w, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-card-foreground">
                      <Target className="w-4 h-4 text-amber mt-0.5 shrink-0" />
                      {w}
                    </li>
                  ))}
                </ul>
              </Card>
            </div>

            {/* Recommendations */}
            {evaluation.recommendations.length > 0 && (
              <Card className="p-6">
                <h3 className="font-display font-semibold text-card-foreground mb-4 flex items-center gap-2">
                  <Lightbulb className="w-5 h-5 text-accent" />
                  Learning Recommendations
                </h3>
                <div className="space-y-3">
                  {evaluation.recommendations.map((rec, i) => (
                    <div key={i} className="p-3 rounded-lg bg-muted/50">
                      <p className="text-sm font-medium text-card-foreground">{rec.topic}</p>
                      <p className="text-sm text-muted-foreground mt-1">{rec.suggestion}</p>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Question Review */}
            <Card className="p-6">
              <h3 className="font-display font-semibold text-card-foreground mb-4">Question Review</h3>
              <div className="space-y-3">
                {questions.map((q, i) => {
                  const isCorrect = answers[i] === q.correct_index;
                  return (
                    <div key={i} className={`p-3 rounded-lg border ${isCorrect ? "border-success/30 bg-success/5" : "border-destructive/30 bg-destructive/5"}`}>
                      <div className="flex items-start gap-2">
                        {isCorrect ? (
                          <CheckCircle2 className="w-4 h-4 text-success mt-0.5 shrink-0" />
                        ) : (
                          <XCircle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
                        )}
                        <div>
                          <p className="text-sm font-medium text-card-foreground">{q.question}</p>
                          {!isCorrect && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Correct: {q.options[q.correct_index]}
                            </p>
                          )}
                        </div>
                        <Badge variant="outline" className={`ml-auto shrink-0 ${difficultyColors[q.difficulty]}`}>
                          {q.difficulty}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>

            <div className="flex gap-3 justify-center">
              <Button onClick={resetQuiz} variant="outline" className="font-display">
                <RotateCcw className="w-4 h-4 mr-2" />
                New Assessment
              </Button>
              <Button
                onClick={() => { setSkill(skill); resetQuiz(); }}
                className="bg-teal text-teal-foreground hover:bg-teal/90 font-display font-semibold"
              >
                Retry Same Skill
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default SkillQuiz;
