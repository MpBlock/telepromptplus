import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { scriptsStore, type Script } from "@/lib/scripts-store";
import { FileText, Play, Plus, Zap, Sparkles, Download } from "lucide-react";

export const Route = createFileRoute("/")({ component: Index });

function Index() {
  const [scripts, setScripts] = useState<Script[]>([]);
  useEffect(() => {
    setScripts(scriptsStore.list());
  }, []);

  return (
    <div className="space-y-8 animate-float-up">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl border border-border/50 gradient-card p-6 md:p-10 shadow-elevated">
        <div
          className="absolute -right-20 -top-20 h-80 w-80 rounded-full opacity-50"
          style={{ background: "var(--gradient-glow)" }}
        />
        <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="space-y-3 max-w-2xl">
            <span className="inline-flex items-center gap-1.5 rounded-full glass px-3 py-1 text-xs font-medium text-muted-foreground">
              <Sparkles className="h-3 w-3 text-primary-glow" /> Teleprompter cinematográfico
            </span>
            <h1 className="font-display text-4xl font-bold leading-tight md:text-5xl">
              Grave como um <span className="text-gradient">profissional</span>.
            </h1>
            <p className="text-muted-foreground md:text-lg">
              Roteiros, prompter fluido e câmera em um só lugar. Controle total da velocidade,
              fonte, cores e gravação em HD.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              to="/scripts/new"
              className="inline-flex items-center gap-2 rounded-xl gradient-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-glow transition-spring hover:scale-105"
            >
              <Plus className="h-4 w-4" /> Novo roteiro
            </Link>
            <Link
              to="/prompter"
              className="inline-flex items-center gap-2 rounded-xl glass px-5 py-3 text-sm font-semibold transition-smooth hover:bg-accent"
            >
              <Play className="h-4 w-4" /> Prompter rápido
            </Link>
          </div>
        </div>
      </section>

      {/* Bento grid */}
      <section className="grid grid-cols-1 gap-4 md:grid-cols-6">
        <Link
          to="/scripts"
          className="md:col-span-3 relative overflow-hidden rounded-2xl border border-border/50 gradient-primary text-primary-foreground p-5 transition-spring hover:scale-[1.02] hover:shadow-glow"
        >
          <FileText className="h-5 w-5 opacity-90" />
          <p className="mt-3 text-3xl font-display font-bold">{scripts.length}</p>
          <p className="text-xs opacity-80">Roteiros salvos</p>
        </Link>

        <div className="md:col-span-3 relative overflow-hidden rounded-2xl border border-border/50 gradient-card p-5">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-display text-lg font-semibold">Gravações</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Ao finalizar, escolha{" "}
                <span className="text-foreground font-medium">salvar no dispositivo</span> ou
                descartar. O app não armazena seus vídeos.
              </p>
            </div>
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent text-primary-glow">
              <Download className="h-5 w-5" />
            </div>
          </div>
        </div>
      </section>

      {/* Quick tips */}
      <section className="rounded-2xl border border-border/50 glass p-6">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary-glow" />
          <h3 className="font-display font-semibold">Dicas rápidas</h3>
        </div>
        <ul className="mt-3 grid gap-2 text-sm text-muted-foreground md:grid-cols-2">
          <li>↑ ↓ controlam a velocidade durante o prompter</li>
          <li>Espaço pausa/retoma a rolagem</li>
          <li>R inicia a gravação em qualquer momento</li>
          <li>
            Pausa por silêncio: ative nos Ajustes para o texto pausar quando você parar de falar e
            continuar quando voltar a falar
          </li>
        </ul>
      </section>
    </div>
  );
}
