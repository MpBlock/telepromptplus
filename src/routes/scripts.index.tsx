import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { scriptsStore, type Script } from "@/lib/scripts-store";
import { Plus, Search, Trash2, Edit3, Play, Star } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/scripts/")({ component: ScriptsPage });

function ScriptsPage() {
  const [scripts, setScripts] = useState<Script[]>([]);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("Todos");

  const nav = useNavigate();

  const refresh = () => setScripts(scriptsStore.list());
  useEffect(refresh, []);

  const cats = useMemo(() => ["Todos", ...scriptsStore.categories()], [scripts]);
  const filtered = scripts.filter(
    (s) =>
      (cat === "Todos" || s.category === cat) &&
      (q === "" ||
        s.title.toLowerCase().includes(q.toLowerCase()) ||
        s.content.toLowerCase().includes(q.toLowerCase())),
  );

  return (
    <div className="space-y-6 animate-float-up">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold">Roteiros</h1>
          <p className="text-sm text-muted-foreground">Crie, organize e marque seus favoritos.</p>
        </div>
        <Link
          to="/scripts/new"
          className="inline-flex items-center gap-2 rounded-xl gradient-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow transition-spring hover:scale-105"
        >
          <Plus className="h-4 w-4" /> Novo roteiro
        </Link>
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar roteiros..."
            className="w-full rounded-xl border border-border bg-input pl-10 pr-4 py-2.5 text-sm outline-none transition-smooth focus:border-primary focus:ring-2 focus:ring-ring/30"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {cats.map((c) => (
          <button
            key={c}
            onClick={() => setCat(c)}
            className={`rounded-full px-4 py-1.5 text-xs font-medium transition-smooth ${cat === c ? "gradient-primary text-primary-foreground shadow-glow" : "bg-secondary text-muted-foreground hover:text-foreground"}`}
          >
            {c}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center">
          <p className="text-muted-foreground">Nenhum roteiro encontrado.</p>
          <Link
            to="/scripts/new"
            className="mt-4 inline-flex items-center gap-2 rounded-xl gradient-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            Criar o primeiro
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((s) => (
            <div
              key={s.id}
              onClick={() => nav({ to: "/scripts/$id", params: { id: s.id } })}
              className="group relative cursor-pointer overflow-hidden rounded-2xl border border-border/50 gradient-card p-5 transition-spring hover:-translate-y-1 hover:border-primary/50 hover:shadow-glow"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="truncate font-display text-lg font-semibold">{s.title}</h3>
                  <p className="text-xs text-muted-foreground">
                    {s.category} · {Math.ceil(s.content.split(/\s+/).length / 130)} min de leitura
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    scriptsStore.toggleFavorite(s.id);
                    refresh();
                  }}
                  className="rounded-lg p-1.5 hover:bg-secondary"
                >
                  <Star
                    className={`h-4 w-4 ${s.favorite ? "fill-primary-glow text-primary-glow" : "text-muted-foreground"}`}
                  />
                </button>
              </div>
              <p className="mt-3 line-clamp-3 text-sm text-muted-foreground">
                {s.content || "Vazio"}
              </p>
              <div className="mt-4 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                <Link
                  to="/prompter/$id"
                  params={{ id: s.id }}
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg gradient-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-spring hover:scale-[1.02]"
                >
                  <Play className="h-3.5 w-3.5" /> Iniciar
                </Link>
                <button
                  onClick={() => nav({ to: "/scripts/$id", params: { id: s.id } })}
                  className="rounded-lg bg-secondary p-2 text-muted-foreground transition-smooth hover:text-foreground"
                >
                  <Edit3 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => {
                    if (confirm("Excluir roteiro?")) {
                      scriptsStore.remove(s.id);
                      refresh();
                      toast.success("Excluído");
                    }
                  }}
                  className="rounded-lg bg-secondary p-2 text-muted-foreground transition-smooth hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
