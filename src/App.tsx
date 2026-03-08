import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import ProfileSetup from "./pages/ProfileSetup";
import ChatPage from "./pages/ChatPage";
import KnowledgeBase from "./pages/KnowledgeBase";
import ResumeAnalyzer from "./pages/ResumeAnalyzer";
import CoverLetterGenerator from "./pages/CoverLetterGenerator";
import SkillQuiz from "./pages/SkillQuiz";
import MockInterview from "./pages/MockInterview";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/profile" element={<ProfileSetup />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/knowledge-base" element={<KnowledgeBase />} />
          <Route path="/resume-analyzer" element={<ResumeAnalyzer />} />
          <Route path="/cover-letter" element={<CoverLetterGenerator />} />
          <Route path="/skill-quiz" element={<SkillQuiz />} />
          <Route path="/mock-interview" element={<MockInterview />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
