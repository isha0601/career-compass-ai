import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Target, Sparkles, ArrowRight, BookOpen, TrendingUp, Users, FileText, Briefcase, Brain, Mic } from "lucide-react";
import { Button } from "@/components/ui/button";

const features = [
  {
    icon: Target,
    title: "Skill Gap Analysis",
    description: "Identify exactly what skills you need to reach your career goals",
  },
  {
    icon: TrendingUp,
    title: "Career Roadmaps",
    description: "Get step-by-step plans with timelines tailored to your profile",
  },
  {
    icon: BookOpen,
    title: "Learning Resources",
    description: "Curated courses, certifications, and tools for your growth",
  },
  {
    icon: Users,
    title: "Industry Insights",
    description: "Real market trends, salary data, and demand projections",
  },
];

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <header className="relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-95"
          style={{ background: "var(--gradient-hero)" }}
        />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_hsl(175_60%_40%_/_0.15),_transparent_50%)]" />
        
        <nav className="relative z-10 flex items-center justify-between px-6 py-5 max-w-6xl mx-auto">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-teal flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-teal-foreground" />
            </div>
            <span className="font-display font-bold text-lg text-primary-foreground">
              PathFinder AI
            </span>
          </div>
        </nav>

        <div className="relative z-10 max-w-4xl mx-auto px-6 pt-16 pb-28 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-teal/10 border border-teal/20 text-teal-foreground text-sm mb-8 animate-fade-in">
            <Sparkles className="w-3.5 h-3.5 text-teal" />
            <span className="text-primary-foreground/80">AI-Powered Career Guidance</span>
          </div>

          <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold text-primary-foreground leading-tight mb-6 animate-fade-in">
            Your Personalized
            <br />
            <span className="text-gradient-hero">Career Navigator</span>
          </h1>

          <p className="text-primary-foreground/70 text-lg sm:text-xl max-w-2xl mx-auto mb-10 animate-fade-in" style={{ animationDelay: "0.1s" }}>
            Get AI-driven skill gap analysis, career roadmaps, and personalized learning paths — all tailored to your unique profile and goals.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center animate-fade-in" style={{ animationDelay: "0.2s" }}>
            <Button
              size="lg"
              className="bg-teal text-teal-foreground hover:bg-teal/90 font-display font-semibold px-8 text-base"
              onClick={() => navigate("/profile")}
            >
              Get Started
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/10 font-display px-8 text-base"
              onClick={() => navigate("/chat")}
            >
              Try Quick Chat
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/10 font-display px-8 text-base"
              onClick={() => navigate("/knowledge-base")}
            >
              <BookOpen className="w-4 h-4 mr-2" />
              Knowledge Base
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/10 font-display px-8 text-base"
              onClick={() => navigate("/resume-analyzer")}
            >
              <FileText className="w-4 h-4 mr-2" />
              Resume Analyzer
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/10 font-display px-8 text-base"
              onClick={() => navigate("/cover-letter")}
            >
              <Briefcase className="w-4 h-4 mr-2" />
              Cover Letter
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/10 font-display px-8 text-base"
              onClick={() => navigate("/skill-quiz")}
            >
              <Brain className="w-4 h-4 mr-2" />
              Skill Quiz
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/10 font-display px-8 text-base"
              onClick={() => navigate("/mock-interview")}
            >
              <Mic className="w-4 h-4 mr-2" />
              Mock Interview
            </Button>
          </div>
        </div>
      </header>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-6 -mt-14 relative z-20">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {features.map((feature, i) => (
            <div
              key={feature.title}
              className="bg-card rounded-xl p-6 shadow-md border border-border hover:shadow-lg transition-all duration-300 animate-fade-in"
              style={{ animationDelay: `${0.1 * i}s` }}
            >
              <div className="w-10 h-10 rounded-lg bg-teal-light flex items-center justify-center mb-4">
                <feature.icon className="w-5 h-5 text-teal" />
              </div>
              <h3 className="font-display font-semibold text-card-foreground mb-2">
                {feature.title}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-4xl mx-auto px-6 py-24 text-center">
        <h2 className="font-display text-3xl font-bold text-foreground mb-4">
          How It Works
        </h2>
        <p className="text-muted-foreground mb-14 max-w-xl mx-auto">
          Three simple steps to your personalized career plan
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { step: "01", title: "Share Your Profile", desc: "Tell us about your skills, education, and career aspirations" },
            { step: "02", title: "AI Analysis", desc: "Our AI analyzes your profile against market data and career paths" },
            { step: "03", title: "Get Your Roadmap", desc: "Receive a personalized plan with actionable steps and resources" },
          ].map((item, i) => (
            <div key={item.step} className="animate-fade-in" style={{ animationDelay: `${0.15 * i}s` }}>
              <div className="text-5xl font-display font-bold text-teal/20 mb-3">{item.step}</div>
              <h3 className="font-display font-semibold text-foreground mb-2">{item.title}</h3>
              <p className="text-sm text-muted-foreground">{item.desc}</p>
            </div>
          ))}
        </div>

        <Button
          size="lg"
          className="mt-14 bg-primary text-primary-foreground hover:bg-primary/90 font-display font-semibold px-8"
          onClick={() => navigate("/profile")}
        >
          Start Your Journey
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">
        <p>PathFinder AI — Personalized Career Guidance powered by AI</p>
      </footer>
    </div>
  );
};

export default Index;
