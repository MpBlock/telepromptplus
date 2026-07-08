import { createFileRoute } from "@tanstack/react-router";
import { Sparkles, Bluetooth, Wifi, ChevronDown } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/settings")({ component: SettingsPage });

type RemoteSection = {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
  items: { title: string; desc: string }[];
};

const REMOTE_SECTIONS: RemoteSection[] = [
  {
    id: "bluetooth",
    icon: Bluetooth,
    title: "Bluetooth",
    subtitle: "Use teclado ou controle como dispositivo de rolagem",
    items: [
      {
        title: "Passo 1",
        desc: "Emparelhe seu teclado ou controle Bluetooth com o dispositivo nas configurações do sistema.",
      },
      {
        title: "Passo 2",
        desc: "Abra o Prompter e use teclas como Espaço, ↑ e ↓ para controlar a rolagem.",
      },
      {
        title: "Passo 3",
        desc: "Dispositivos Bluetooth HID funcionam como teclado no app; não é preciso parear dentro do Prompter.",
      },
      {
        title: "Compatíveis",
        desc: "Teclados Bluetooth, apresentadores, controles genéricos HID e teclados sem fio.",
      },
    ],
  },
  {
    id: "lan",
    icon: Wifi,
    title: "Wi-Fi / LAN Local",
    subtitle: "Controle um dispositivo a partir de outro",
    items: [
      {
        title: "Cenário",
        desc: "Use um tablet como receiver e outro celular/computador como controller.",
      },
      {
        title: "Passo 1",
        desc: "No Prompter receiver, abra o painel de controle remoto e gere o código de sessão.",
      },
      {
        title: "Passo 2",
        desc: "No controller, abra o Prompter e cole o código do receiver para conectar.",
      },
      {
        title: "Passo 3",
        desc: "Compartilhe o código de resposta do controller de volta para o receiver.",
      },
      {
        title: "Resultado",
        desc: "Depois da conexão, controle Play/Pause, velocidade e reinício remotamente.",
      },
    ],
  },
];

function SettingsPage() {
  const [openRemote, setOpenRemote] = useState<string | null>("bluetooth");

  return (
    <div className="space-y-6 max-w-4xl animate-float-up">
      <div>
        <h1 className="font-display text-3xl font-bold">Ajustes</h1>
        <p className="text-sm text-muted-foreground">Personalize sua experiência.</p>
      </div>

      {/* Premium */}
      <section className="rounded-2xl border border-primary/30 bg-primary/10 p-6">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary-glow" />
          <h2 className="font-display text-lg font-semibold">Premium</h2>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Em breve: gravação 4K, marca d'água personalizada, sincronização em nuvem e exportação
          MP4.
        </p>
        <button
          disabled
          className="mt-4 rounded-xl gradient-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground opacity-60"
        >
          Em breve
        </button>
      </section>

      {/* Remote Control Section */}
      <section className="rounded-2xl border border-border/50 bg-card/60 backdrop-blur-sm overflow-hidden">
        <header className="flex items-start gap-4 p-6 border-b border-border">
          <div className="rounded-xl gradient-primary p-2.5 shadow-glow">
            <Wifi className="h-5 w-5 text-primary-foreground" />
          </div>
          <div className="flex-1">
            <h2 className="font-display text-lg font-semibold">Controle remoto</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Controle a gravação e rolagem via Bluetooth, Wi-Fi ou teclado.
            </p>
          </div>
        </header>

        {/* Accordion for remote options */}
        <ul className="divide-y divide-border/50 p-2">
          {REMOTE_SECTIONS.map((section) => {
            const Icon = section.icon;
            const isOpen = openRemote === section.id;
            return (
              <li key={section.id}>
                <button
                  onClick={() => setOpenRemote(isOpen ? null : section.id)}
                  className="flex w-full items-center justify-between gap-3 rounded-xl px-4 py-4 text-left transition-smooth hover:bg-secondary/40"
                  aria-expanded={isOpen}
                >
                  <div className="flex items-center gap-3 flex-1">
                    <span className="rounded-lg bg-secondary/60 p-2">
                      <Icon className="h-4 w-4 text-primary-glow" />
                    </span>
                    <div>
                      <p className="font-medium">{section.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{section.subtitle}</p>
                    </div>
                  </div>
                  <ChevronDown
                    className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ${
                      isOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {isOpen && (
                  <div className="px-4 pb-4 pt-2 animate-in fade-in slide-in-from-top-2">
                    <div className="ml-14 grid gap-3">
                      {section.items.map((item) => (
                        <div
                          key={item.title}
                          className="rounded-lg border border-border/40 bg-background/50 p-3 hover:bg-background/70 transition-smooth"
                        >
                          <p className="text-sm font-semibold text-foreground">{item.title}</p>
                          <p className="text-xs text-muted-foreground mt-1">{item.desc}</p>
                        </div>
                      ))}
                      <button className="mt-2 self-start rounded-lg border border-primary/40 bg-primary/10 px-4 py-2 text-xs font-semibold text-primary-glow hover:bg-primary/20 transition-smooth">
                        Configurar agora
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {/* Quick tip */}
      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5">
        <p className="text-sm">
          <b>💡 Dica:</b> Combine métodos! Por exemplo: grave em um tablet via Wi-Fi enquanto
          controla com um Bluetooth keyboard portátil ou outro celular.
        </p>
      </div>
    </div>
  );
}
