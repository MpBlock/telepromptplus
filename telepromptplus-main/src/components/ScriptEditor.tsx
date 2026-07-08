import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { scriptsStore, type Script } from "@/lib/scripts-store";
import { ArrowLeft, Save, Upload, Play, Trash2, Clipboard } from "lucide-react";
import { toast } from "sonner";

export function ScriptEditor({ id }: { id: string }) {
  const nav = useNavigate();
  const [script, setScript] = useState<Script | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("Geral");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (id === "new") {
      setScript(null);
      setTitle("");
      setContent("");
      setCategory("Geral");
    } else {
      const s = scriptsStore.get(id);
      if (s) {
        setScript(s);
        setTitle(s.title);
        setContent(s.content);
        setCategory(s.category);
      }
    }
  }, [id]);

  const cats = scriptsStore.categories();
  const wordCount = content.trim().split(/\s+/).filter(Boolean).length;
  const readMin = Math.max(1, Math.ceil(wordCount / 130));

  const save = (then?: (s: Script) => void) => {
    if (!title.trim()) {
      toast.error("Dê um título ao roteiro");
      return;
    }
    if (!content.trim()) {
      toast.error("Escreva o conteúdo do roteiro");
      return;
    }
    const s = scriptsStore.upsert({ id: script?.id, title, content, category });
    setScript(s);
    toast.success("Salvo");
    then?.(s);
  };

  const onFile = async (f: File) => {
    if (f.name.endsWith(".txt")) {
      setContent(await f.text());
      toast.success("Texto importado");
    } else if (f.name.endsWith(".docx")) {
      // @ts-expect-error - browser build has no types
      const mammoth = await import("mammoth/mammoth.browser.js");
      const buf = await f.arrayBuffer();
      const { value } = await mammoth.extractRawText({ arrayBuffer: buf });
      setContent(value);
      toast.success("DOCX importado");
    } else {
      toast.error("Formato não suportado (use .txt ou .docx)");
    }
  };

  return (
    <div className="space-y-6 animate-float-up">
      <div className="flex items-center justify-between gap-3">
        <button
          onClick={() => nav({ to: "/scripts" })}
          className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-smooth hover:bg-secondary hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar
        </button>
        <div className="flex flex-wrap gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".txt,.docx"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
          />
          <button
            onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-secondary px-3 py-2 text-sm font-medium transition-smooth hover:bg-accent"
          >
            <Upload className="h-4 w-4" /> Importar
          </button>
          <button
            onClick={async () => {
              try {
                const t = await navigator.clipboard.readText();
                setContent((c) => c + (c ? "\n\n" : "") + t);
                toast.success("Colado");
              } catch {
                toast.error("Sem permissão");
              }
            }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-secondary px-3 py-2 text-sm font-medium transition-smooth hover:bg-accent"
          >
            <Clipboard className="h-4 w-4" /> Colar
          </button>
          <button
            onClick={() => save()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-secondary px-3 py-2 text-sm font-medium transition-smooth hover:bg-accent"
          >
            <Save className="h-4 w-4" /> Salvar
          </button>
          <button
            onClick={() => save((s) => nav({ to: "/prompter/$id", params: { id: s.id } }))}
            className="inline-flex items-center gap-1.5 rounded-lg gradient-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-glow transition-spring hover:scale-105"
          >
            <Play className="h-4 w-4" /> Iniciar prompter
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-[1fr,260px]">
        <div className="space-y-4">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Título do roteiro"
            className="w-full rounded-xl border border-border bg-card px-5 py-4 font-display text-2xl font-semibold text-foreground outline-none transition-smooth placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-ring/30"
          />
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Comece a escrever seu roteiro aqui..."
            className="min-h-[60vh] w-full resize-none rounded-2xl border border-border bg-card p-6 text-base leading-relaxed text-foreground outline-none transition-smooth placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-ring/30"
          />
        </div>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-border/50 gradient-card p-5">
            <h3 className="font-display font-semibold">Detalhes</h3>
            <div className="mt-4 space-y-3">
              <div>
                <label className="text-xs text-muted-foreground">Categoria</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-input px-3 py-2 text-sm outline-none focus:border-primary"
                >
                  {cats.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="rounded-lg bg-background/40 p-3">
                  <p className="font-display text-2xl font-bold">{wordCount}</p>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    palavras
                  </p>
                </div>
                <div className="rounded-lg bg-background/40 p-3">
                  <p className="font-display text-2xl font-bold">{readMin}'</p>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    leitura
                  </p>
                </div>
              </div>
            </div>
          </div>
          {script && (
            <button
              onClick={() => {
                if (confirm("Excluir?")) {
                  scriptsStore.remove(script.id);
                  nav({ to: "/scripts" });
                }
              }}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm font-medium text-destructive transition-smooth hover:bg-destructive/20"
            >
              <Trash2 className="h-4 w-4" /> Excluir roteiro
            </button>
          )}
        </aside>
      </div>
    </div>
  );
}
