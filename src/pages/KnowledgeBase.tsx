import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Upload,
  FileText,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Trash2,
  BookOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

type CareerDocument = {
  id: string;
  file_name: string;
  file_path: string;
  doc_type: string;
  chunk_count: number;
  status: string;
  created_at: string;
};

const DOC_TYPES = [
  { value: "career_guide", label: "Career Guide" },
  { value: "job_description", label: "Job Description" },
  { value: "industry_report", label: "Industry Report" },
  { value: "resume", label: "Resume / CV" },
  { value: "other", label: "Other" },
];

const STATUS_CONFIG: Record<string, { icon: typeof CheckCircle2; color: string; label: string }> = {
  pending: { icon: Clock, color: "text-muted-foreground", label: "Pending" },
  processing: { icon: Loader2, color: "text-amber", label: "Processing" },
  indexed: { icon: CheckCircle2, color: "text-success", label: "Indexed" },
  failed: { icon: XCircle, color: "text-destructive", label: "Failed" },
};

const KnowledgeBase = () => {
  const navigate = useNavigate();
  const [documents, setDocuments] = useState<CareerDocument[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [docType, setDocType] = useState("career_guide");
  const [isDragging, setIsDragging] = useState(false);

  const fetchDocuments = useCallback(async () => {
    const { data } = await supabase
      .from("career_documents")
      .select("*")
      .order("created_at", { ascending: false }) as any;
    if (data) setDocuments(data);
  }, []);

  useEffect(() => {
    fetchDocuments();
    const interval = setInterval(fetchDocuments, 5000);
    return () => clearInterval(interval);
  }, [fetchDocuments]);

  const handleUpload = async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    for (const file of fileArray) {
      if (!file.name.endsWith(".pdf") && !file.name.endsWith(".txt") && !file.name.endsWith(".md")) {
        toast.error(`Unsupported file type: ${file.name}. Please upload PDF, TXT, or MD files.`);
        continue;
      }
      if (file.size > 20 * 1024 * 1024) {
        toast.error(`File too large: ${file.name}. Max 20MB.`);
        continue;
      }

      setIsUploading(true);
      setUploadProgress(10);

      try {
        const filePath = `uploads/${Date.now()}_${file.name}`;

        // Upload to storage
        setUploadProgress(30);
        const { error: uploadError } = await supabase.storage
          .from("career-documents")
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        setUploadProgress(50);

        // Create document record
        const { data: docData, error: docError } = await supabase
          .from("career_documents")
          .insert({
            file_name: file.name,
            file_path: filePath,
            doc_type: docType,
            status: "pending",
          } as any)
          .select()
          .single() as any;

        if (docError) throw docError;

        setUploadProgress(70);

        // Trigger ingestion
        const resp = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ingest-document`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            },
            body: JSON.stringify({
              documentId: docData.id,
              filePath,
              fileName: file.name,
              docType,
            }),
          }
        );

        setUploadProgress(90);

        if (!resp.ok) {
          const err = await resp.json().catch(() => ({ error: "Ingestion failed" }));
          throw new Error(err.error);
        }

        setUploadProgress(100);
        toast.success(`${file.name} uploaded and indexed successfully!`);
        fetchDocuments();
      } catch (e: any) {
        console.error("Upload error:", e);
        toast.error(`Failed to process ${file.name}: ${e.message}`);
        fetchDocuments();
      }
    }

    setIsUploading(false);
    setUploadProgress(0);
  };

  const handleDelete = async (doc: CareerDocument) => {
    try {
      await supabase.from("document_chunks").delete().eq("document_id", doc.id) as any;
      await supabase.from("career_documents").delete().eq("id", doc.id) as any;
      await supabase.storage.from("career-documents").remove([doc.file_path]);
      toast.success(`Deleted ${doc.file_name}`);
      fetchDocuments();
    } catch (e: any) {
      toast.error(`Failed to delete: ${e.message}`);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) {
      handleUpload(e.dataTransfer.files);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 sm:px-6 py-4 border-b border-border bg-card">
        <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="w-8 h-8 rounded-lg bg-teal flex items-center justify-center">
          <BookOpen className="w-4 h-4 text-teal-foreground" />
        </div>
        <div>
          <h1 className="font-display font-semibold text-foreground text-sm">Knowledge Base</h1>
          <p className="text-xs text-muted-foreground">Upload documents for RAG-enhanced guidance</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="ml-auto text-xs"
          onClick={() => navigate("/chat")}
        >
          Go to Chat
        </Button>
      </header>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Upload Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Select value={docType} onValueChange={setDocType}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DOC_TYPES.map((dt) => (
                  <SelectItem key={dt.value} value={dt.value}>
                    {dt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div
            className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors ${
              isDragging
                ? "border-teal bg-teal/5"
                : "border-border hover:border-teal/50"
            }`}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
          >
            {isUploading ? (
              <div className="space-y-4">
                <Loader2 className="w-10 h-10 text-teal mx-auto animate-spin" />
                <p className="text-sm text-muted-foreground">Processing document...</p>
                <Progress value={uploadProgress} className="max-w-xs mx-auto" />
              </div>
            ) : (
              <>
                <Upload className="w-10 h-10 text-muted-foreground mx-auto mb-4" />
                <p className="text-foreground font-medium mb-1">
                  Drop files here or click to upload
                </p>
                <p className="text-xs text-muted-foreground mb-4">
                  Supports PDF, TXT, and MD files (max 20MB)
                </p>
                <Button
                  variant="outline"
                  onClick={() => {
                    const input = document.createElement("input");
                    input.type = "file";
                    input.multiple = true;
                    input.accept = ".pdf,.txt,.md";
                    input.onchange = (e) => {
                      const files = (e.target as HTMLInputElement).files;
                      if (files) handleUpload(files);
                    };
                    input.click();
                  }}
                >
                  Choose Files
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Document List */}
        <div>
          <h2 className="font-display font-semibold text-foreground mb-4">
            Indexed Documents ({documents.length})
          </h2>

          {documents.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No documents uploaded yet</p>
              <p className="text-xs mt-1">Upload career guides, job descriptions, or industry reports</p>
            </div>
          ) : (
            <div className="space-y-3">
              {documents.map((doc) => {
                const statusCfg = STATUS_CONFIG[doc.status] || STATUS_CONFIG.pending;
                const StatusIcon = statusCfg.icon;
                return (
                  <div
                    key={doc.id}
                    className="flex items-center gap-3 bg-card border border-border rounded-lg px-4 py-3"
                  >
                    <FileText className="w-5 h-5 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {doc.file_name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {doc.doc_type.replace("_", " ")} · {doc.chunk_count} chunks
                      </p>
                    </div>
                    <div className={`flex items-center gap-1 text-xs ${statusCfg.color}`}>
                      <StatusIcon className={`w-3.5 h-3.5 ${doc.status === "processing" ? "animate-spin" : ""}`} />
                      {statusCfg.label}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0 h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDelete(doc)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default KnowledgeBase;
