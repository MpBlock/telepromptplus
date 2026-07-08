import { useEffect, useRef, useState } from "react";
import { settingsStore, type Settings, scriptsStore, type Script } from "@/lib/scripts-store";
import { useNavigate } from "@tanstack/react-router";
import {
  X,
  Play,
  Pause,
  RotateCcw,
  Video,
  Square,
  Camera,
  Settings as SettingsIcon,
  FlipHorizontal,
  FlipVertical,
  ChevronUp,
  ChevronDown,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Download,
  Share2,
  Mic,
  MicOff,
  Pencil,
  Check,
} from "lucide-react";
import { toast } from "sonner";

const FONTS = [
  "Space Grotesk",
  "DM Sans",
  "Inter",
  "Georgia",
  "Times New Roman",
  "Courier New",
  "Arial",
];
const COLORS = ["#ffffff", "#fde047", "#86efac", "#7dd3fc", "#f9a8d4", "#fb923c"];
const BG_COLORS = ["#000000", "#0a0a1a", "#1e1e5a", "#064e3b", "#7f1d1d", "#3f3f46", "#ffffff"];

const WELCOME =
  "Bem-vindo ao Prompter.io.\n\nEdite ou importe seu roteiro para começar. Use os controles para ajustar velocidade, tamanho da fonte, cores e iniciar a gravação.\n\nBoas gravações!";

export function Prompter({ scriptId }: { scriptId?: string }) {
  const nav = useNavigate();
  const [settings, setSettings] = useState<Settings>(() => settingsStore.get());
  const [script, setScript] = useState<Script | undefined>(undefined);
  const [text, setText] = useState<string>(WELCOME);
  useEffect(() => {
    if (!scriptId) {
      setScript(undefined);
      setText(WELCOME);
      return;
    }
    const s = scriptsStore.get(scriptId);
    if (s) {
      setScript(s);
      setText(s.content || WELCOME);
    }
  }, [scriptId]);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [recording, setRecording] = useState(false);
  const [paused, setPaused] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [micOn, setMicOn] = useState(true);
  const [lastUrl, setLastUrl] = useState<string | null>(null);
  const [pendingRec, setPendingRec] = useState<{
    url: string;
    blob: Blob;
    duration: number;
  } | null>(null);
  const [editing, setEditing] = useState(false);
  const [showHelp, setShowHelp] = useState(() => {
    if (typeof window === "undefined") return false;
    return !localStorage.getItem("tp.helpSeen.v1");
  });
  const dismissHelp = () => {
    localStorage.setItem("tp.helpSeen.v1", "1");
    setShowHelp(false);
  };

  const scrollRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const elapsedRef = useRef<number>(0);
  const tickRef = useRef<number | null>(null);
  // Voice-activated pause
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioSrcRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const voiceRafRef = useRef<number | null>(null);
  const voiceActiveRef = useRef<boolean>(true);
  const lastVoiceAtRef = useRef<number>(0);
  const speedMultRef = useRef<number>(1);
  const [voiceLevel, setVoiceLevel] = useState(0);
  const [voiceActive, setVoiceActive] = useState(true);

  type RemoteCommand =
    | { action: "togglePlay" }
    | { action: "speed"; delta: number }
    | { action: "restart" };

  type RemoteMode = "off" | "host" | "client";

  const [remoteMode, setRemoteMode] = useState<RemoteMode>("off");
  const [remoteStatus, setRemoteStatus] = useState("Desconectado");
  const [remoteOffer, setRemoteOffer] = useState("");
  const [remoteAnswer, setRemoteAnswer] = useState("");
  const [remoteInput, setRemoteInput] = useState("");
  const [remoteConnected, setRemoteConnected] = useState(false);
  const [remoteError, setRemoteError] = useState<string | null>(null);
  const [remoteLog, setRemoteLog] = useState<string[]>([]);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const channelRef = useRef<RTCDataChannel | null>(null);

  const addRemoteLog = (message: string) => {
    setRemoteLog((current) => [message, ...current].slice(0, 10));
  };

  const copyToClipboard = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success("Código copiado para a área de transferência");
    } catch {
      toast.error("Não foi possível copiar o código");
    }
  };

  const cleanupRemote = () => {
    channelRef.current?.close();
    pcRef.current?.close();
    channelRef.current = null;
    pcRef.current = null;
    setRemoteConnected(false);
    setRemoteOffer("");
    setRemoteAnswer("");
    setRemoteInput("");
    setRemoteStatus("Desconectado");
    setRemoteError(null);
    setRemoteMode("off");
    addRemoteLog("Sessão remota encerrada");
  };

  const handleRemoteCommand = (command: RemoteCommand) => {
    switch (command.action) {
      case "togglePlay":
        setPlaying((value) => !value);
        return;
      case "speed":
        update({ speed: Math.min(150, Math.max(5, settings.speed + command.delta)) });
        return;
      case "restart":
        restart();
        return;
      default:
        return;
    }
  };

  const setupDataChannel = (channel: RTCDataChannel) => {
    channelRef.current = channel;
    channel.onopen = () => {
      setRemoteConnected(true);
      setRemoteStatus("Conectado");
      addRemoteLog("Canal de controle remoto aberto");
    };
    channel.onclose = () => {
      setRemoteConnected(false);
      setRemoteStatus("Desconectado");
      addRemoteLog("Canal de controle remoto fechado");
    };
    channel.onmessage = (event) => {
      try {
        const command = JSON.parse(event.data) as RemoteCommand;
        handleRemoteCommand(command);
      } catch (error) {
        console.warn("Comando remoto inválido", error);
      }
    };
  };

  const createPeerConnection = (mode: RemoteMode) => {
    cleanupRemote();
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    pc.oniceconnectionstatechange = () => {
      setRemoteStatus(pc.iceConnectionState === "connected" ? "Conectado" : pc.iceConnectionState);
    };

    pc.onicecandidate = (event) => {
      if (!event.candidate && pc.localDescription) {
        const payload = JSON.stringify(pc.localDescription);
        if (mode === "host") {
          setRemoteOffer(payload);
          addRemoteLog("Oferta remota pronta");
        } else {
          setRemoteAnswer(payload);
          addRemoteLog("Resposta remota pronta");
        }
      }
    };

    if (mode === "client") {
      pc.ondatachannel = (event) => setupDataChannel(event.channel);
    } else {
      const channel = pc.createDataChannel("prompter-remote");
      setupDataChannel(channel);
    }

    pcRef.current = pc;
    return pc;
  };

  const startRemoteHost = async () => {
    try {
      const pc = createPeerConnection("host");
      setRemoteMode("host");
      setRemoteStatus("Aguardando controlador");
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
    } catch (error) {
      setRemoteError("Não foi possível iniciar a sessão remota.");
      console.error(error);
    }
  };

  const acceptRemoteAnswer = async () => {
    try {
      if (!pcRef.current) throw new Error("Conexão não criada");
      const answer = JSON.parse(remoteInput) as RTCSessionDescriptionInit;
      await pcRef.current.setRemoteDescription(answer);
      setRemoteInput("");
      setRemoteError(null);
      addRemoteLog("Resposta aplicada");
    } catch (error) {
      setRemoteError("Resposta inválida. Verifique o código e tente novamente.");
      console.error(error);
    }
  };

  const startRemoteClient = () => {
    createPeerConnection("client");
    setRemoteMode("client");
    setRemoteStatus("Aguardando oferta");
  };

  const acceptRemoteOffer = async () => {
    try {
      if (!pcRef.current) throw new Error("Conexão não criada");
      const offer = JSON.parse(remoteInput) as RTCSessionDescriptionInit;
      await pcRef.current.setRemoteDescription(offer);
      const answer = await pcRef.current.createAnswer();
      await pcRef.current.setLocalDescription(answer);
      setRemoteInput("");
      setRemoteError(null);
      addRemoteLog("Oferta aceita e resposta criada");
    } catch (error) {
      setRemoteError("Oferta inválida. Verifique o código e tente novamente.");
      console.error(error);
    }
  };

  const sendRemoteCommand = (command: RemoteCommand) => {
    if (channelRef.current?.readyState === "open") {
      channelRef.current.send(JSON.stringify(command));
    }
  };

  const update = (patch: Partial<Settings>) => {
    setSettings((s) => {
      const n = { ...s, ...patch };
      settingsStore.set(patch);
      return n;
    });
  };

  const scrollAccRef = useRef(0);
  useEffect(() => {
    if (!playing) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }
    let last = performance.now();
    const el = scrollRef.current;
    if (el) scrollAccRef.current = el.scrollTop;
    const loop = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      const el = scrollRef.current;
      if (el) {
        // Smooth target multiplier — 1 when voice active (or feature off), 0 when silent
        const target = settings.voicePause ? (voiceActiveRef.current ? 1 : 0) : 1;
        const k = Math.min(1, dt * 5); // ~200ms ease
        speedMultRef.current += (target - speedMultRef.current) * k;
        const px = (settings.speed / 50) * 60 * dt * speedMultRef.current;
        scrollAccRef.current += px;
        el.scrollTop = scrollAccRef.current;
        const max = el.scrollHeight - el.clientHeight;
        setProgress(max > 0 ? Math.min(100, (el.scrollTop / max) * 100) : 0);
        if (el.scrollTop >= max) {
          setPlaying(false);
          return;
        }
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [playing, settings.speed, settings.voicePause]);

  // Voice activity detection — runs whenever feature is enabled and stream/mic available
  useEffect(() => {
    const stream = streamRef.current;
    const stop = () => {
      if (voiceRafRef.current) {
        cancelAnimationFrame(voiceRafRef.current);
        voiceRafRef.current = null;
      }
      try {
        audioSrcRef.current?.disconnect();
      } catch (e) {
        console.debug("Voice audioSrc disconnect failed", e);
      }
      try {
        analyserRef.current?.disconnect();
      } catch (e) {
        console.debug("Voice analyser disconnect failed", e);
      }
      try {
        audioCtxRef.current?.close();
      } catch (e) {
        console.debug("Voice audioCtx close failed", e);
      }

      audioSrcRef.current = null;
      analyserRef.current = null;
      audioCtxRef.current = null;
      voiceActiveRef.current = true;
      setVoiceActive(true);
      setVoiceLevel(0);
    };
    if (
      !settings.voicePause ||
      !showCamera ||
      !micOn ||
      !stream ||
      stream.getAudioTracks().length === 0
    ) {
      stop();
      return;
    }
    try {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) throw new Error("AudioContext indisponível");

      const ctx = new Ctx();
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.6;
      src.connect(analyser);
      audioCtxRef.current = ctx;
      audioSrcRef.current = src;
      analyserRef.current = analyser;
      const buf = new Uint8Array(analyser.fftSize);
      lastVoiceAtRef.current = performance.now();
      const tick = () => {
        analyser.getByteTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) {
          const v = (buf[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / buf.length);
        const level = Math.min(100, rms * 200); // 0..100
        setVoiceLevel(level);
        const now = performance.now();
        if (level >= settings.voiceThreshold) {
          lastVoiceAtRef.current = now;
          if (!voiceActiveRef.current) {
            voiceActiveRef.current = true;
            setVoiceActive(true);
          }
        } else if (now - lastVoiceAtRef.current > settings.voiceSilenceMs) {
          if (voiceActiveRef.current) {
            voiceActiveRef.current = false;
            setVoiceActive(false);
          }
        }
        voiceRafRef.current = requestAnimationFrame(tick);
      };
      voiceRafRef.current = requestAnimationFrame(tick);
    } catch (e) {
      console.error("Voice detection failed:", e);
    }
    return stop;
  }, [settings.voicePause, settings.voiceThreshold, settings.voiceSilenceMs, showCamera, micOn]);

  // Keyboard controls
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        setPlaying((p) => !p);
      } else if (e.code === "ArrowUp") update({ speed: Math.min(150, settings.speed + 5) });
      else if (e.code === "ArrowDown") update({ speed: Math.max(5, settings.speed - 5) });
      else if (e.key === "r" || e.key === "R") toggleRecord();
      else if (e.key === "Escape") nav({ to: "/" });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.speed]);

  // Camera setup
  const startCamera = async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      toast.error("Seu navegador não suporta câmera. Abra em Chrome/Safari atualizado, em HTTPS.");
      return;
    }
    if (!window.isSecureContext) {
      toast.error("A câmera só funciona em conexão segura (HTTPS).");
      return;
    }
    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: settings.camera,
          width:
            settings.resolution === "720p"
              ? 1280
              : settings.resolution === "1080p"
                ? 1920
                : { ideal: 3840 },
          height:
            settings.resolution === "720p"
              ? 720
              : settings.resolution === "1080p"
                ? 1080
                : { ideal: 2160 },
        },
        audio: micOn,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      setShowCamera(true);
      // Attach in next tick so the <video> element is mounted
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      }, 50);
      toast.success("Câmera ligada");
    } catch (e) {
      const err = e as { name?: string; message?: string };
      const name = err?.name || "";
      let msg = err?.message || "Falha desconhecida";

      if (name === "NotAllowedError")
        msg = "Permissão negada. Libere a câmera nas configurações do navegador.";
      else if (name === "NotFoundError") msg = "Nenhuma câmera encontrada no dispositivo.";
      else if (name === "NotReadableError")
        msg = "Câmera em uso por outro app. Feche-o e tente novamente.";
      else if (name === "SecurityError")
        msg = "Bloqueado pelo navegador. Abra o app publicado (HTTPS) ou em uma nova aba.";
      console.error("getUserMedia failed:", e);
      toast.error("Câmera: " + msg);
    }
  };
  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setShowCamera(false);
  };

  useEffect(
    () => () => {
      stopCamera();
      if (tickRef.current) clearInterval(tickRef.current);
      cleanupRemote();
    },
    [],
  );

  const startElapsed = () => {
    elapsedRef.current = 0;
    setElapsed(0);
    tickRef.current = window.setInterval(() => {
      elapsedRef.current += 1;
      setElapsed(elapsedRef.current);
    }, 1000);
  };
  const stopElapsed = () => {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
  };

  const startRecorder = async () => {
    if (!streamRef.current) await startCamera();
    if (!streamRef.current) return false;
    chunksRef.current = [];
    // iOS Safari only saves mp4/mov to Photos. Prefer mp4 when supported.
    const mime = MediaRecorder.isTypeSupported("video/mp4;codecs=h264,aac")
      ? "video/mp4;codecs=h264,aac"
      : MediaRecorder.isTypeSupported("video/mp4")
        ? "video/mp4"
        : MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
          ? "video/webm;codecs=vp9,opus"
          : MediaRecorder.isTypeSupported("video/webm;codecs=vp8,opus")
            ? "video/webm;codecs=vp8,opus"
            : "video/webm";
    const rec = new MediaRecorder(streamRef.current!, {
      mimeType: mime,
      videoBitsPerSecond: 6_000_000,
    });
    rec.ondataavailable = (e) => {
      if (e.data.size) chunksRef.current.push(e.data);
    };
    rec.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mime });
      const url = URL.createObjectURL(blob);
      setLastUrl(url);
      setPendingRec({ url, blob, duration: elapsedRef.current });
    };
    recorderRef.current = rec;
    rec.start(1000);
    setRecording(true);
    setPaused(false);
    startElapsed();
    return true;
  };

  const toggleRecord = async () => {
    if (recording) {
      recorderRef.current?.stop();
      setRecording(false);
      setPaused(false);
      stopElapsed();
      setPlaying(false);
    } else {
      // Make sure the camera is live BEFORE we start the countdown,
      // so the user sees the preview while counting down.
      if (!streamRef.current) {
        await startCamera();
        if (!streamRef.current) return;
      }
      // Start recording immediately, then run the countdown for the scroll.
      const ok = await startRecorder();
      if (!ok) return;
      if (settings.countdown > 0) {
        setCountdown(settings.countdown);
        let n = settings.countdown;
        const iv = setInterval(() => {
          n -= 1;
          if (n <= 0) {
            clearInterval(iv);
            setCountdown(null);
            setPlaying(true);
          } else setCountdown(n);
        }, 1000);
      } else {
        setPlaying(true);
      }
    }
  };

  const togglePause = () => {
    if (!recorderRef.current) return;
    if (paused) {
      recorderRef.current.resume();
      startElapsed();
      setPaused(false);
      setPlaying(true);
    } else {
      recorderRef.current.pause();
      stopElapsed();
      setPaused(true);
      setPlaying(false);
    }
  };

  const restart = () => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
    setProgress(0);
  };
  const fmt = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const downloadLast = () => {
    if (!lastUrl) return;
    const a = document.createElement("a");
    a.href = lastUrl;
    a.download = `prompter-${Date.now()}.webm`;
    a.click();
  };
  const shareLast = async () => {
    if (!lastUrl) return;
    try {
      const blob = await (await fetch(lastUrl)).blob();
      const file = new File([blob], "video.webm", { type: blob.type });
      if ((navigator as any).canShare?.({ files: [file] })) {
        await (navigator as any).share({ files: [file], title: "Prompter.io" });
      } else {
        downloadLast();
      }
    } catch {
      downloadLast();
    }
  };

  const cameraFull = showCamera && settings.cameraSize === "full";
  const camSizeClass =
    settings.cameraSize === "sm"
      ? "h-24 w-20 md:h-32 md:w-24"
      : settings.cameraSize === "lg"
        ? "h-48 w-36 md:h-72 md:w-56"
        : "h-32 w-24 md:h-48 md:w-36";

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: cameraFull ? "#000" : settings.bgColor }}
    >
      {cameraFull && (
        <>
          <video
            ref={videoRef}
            muted
            playsInline
            className="absolute inset-0 z-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 z-0 bg-black/40" />
        </>
      )}
      {/* Top bar */}
      <div className="flex items-center justify-between gap-3 p-3 md:p-4 bg-black/30 backdrop-blur-md text-white">
        <button
          onClick={() => {
            stopCamera();
            nav({ to: "/" });
          }}
          className="rounded-lg p-2 hover:bg-white/10"
          aria-label="Sair"
        >
          <X className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="rounded-full bg-white/10 px-3 py-1">{Math.round(progress)}%</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              if (editing) {
                if (script) {
                  scriptsStore.upsert({
                    id: script.id,
                    title: script.title,
                    content: text,
                    category: script.category,
                    favorite: script.favorite,
                  });
                  toast.success("Roteiro salvo");
                } else {
                  toast.success("Texto atualizado");
                }
                setEditing(false);
              } else {
                setPlaying(false);
                setEditing(true);
              }
            }}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-smooth ${editing ? "bg-primary/30 text-white" : "hover:bg-white/10"}`}
            aria-label={editing ? "Concluir edição" : "Editar texto"}
          >
            {editing ? (
              <>
                <Check className="h-4 w-4" /> Concluir
              </>
            ) : (
              <>
                <Pencil className="h-4 w-4" /> Editar
              </>
            )}
          </button>
          <button
            onClick={() => setShowHelp(true)}
            className="rounded-lg px-2 py-2 text-xs hover:bg-white/10"
          >
            Ajuda
          </button>
          <button
            onClick={() => setShowSettings((v) => !v)}
            className="rounded-lg p-2 hover:bg-white/10"
            aria-label="Ajustes"
          >
            <SettingsIcon className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Big REC indicator — visible during recording */}
      {recording && (
        <div className="pointer-events-none absolute left-1/2 top-16 z-40 -translate-x-1/2 flex items-center gap-2 rounded-full bg-red-600/90 px-4 py-2 text-sm font-semibold text-white shadow-elevated backdrop-blur-md">
          <span className="relative flex h-3.5 w-3.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex h-3.5 w-3.5 rounded-full bg-white" />
          </span>
          <span className="font-mono">REC {fmt(elapsed)}</span>
          {paused && (
            <span className="rounded-full bg-yellow-500/90 px-2 py-0.5 text-[10px]">PAUSADO</span>
          )}
          {settings.voicePause && playing && !voiceActive && (
            <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px]">SILÊNCIO</span>
          )}
        </div>
      )}

      {/* Camera preview (floating) */}
      {showCamera && !cameraFull && (
        <video
          ref={videoRef}
          muted
          playsInline
          className={`absolute right-4 top-20 z-30 ${camSizeClass} rounded-2xl object-cover shadow-elevated border-2 border-white/20`}
        />
      )}

      {/* Prompter text */}
      <div
        ref={scrollRef}
        className="relative z-10 flex-1 overflow-y-auto"
        style={{
          transform: editing
            ? undefined
            : `${settings.mirrorH ? "scaleX(-1)" : ""} ${settings.mirrorV ? "scaleY(-1)" : ""}`.trim() ||
              undefined,
        }}
        onClick={() => {
          if (!editing) setPlaying((p) => !p);
        }}
      >
        <div
          className="pointer-events-none sticky top-0 z-10 h-32 bg-gradient-to-b from-current to-transparent"
          style={{ color: cameraFull ? "#000" : settings.bgColor }}
        />
        {editing ? (
          <textarea
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            placeholder="Digite ou cole seu roteiro aqui..."
            className="mx-auto block w-full max-w-4xl resize-none border-0 bg-transparent px-6 py-[20vh] outline-none whitespace-pre-wrap min-h-[60vh]"
            style={{
              color: settings.fontColor,
              fontFamily: settings.fontFamily,
              fontSize: settings.fontSize,
              lineHeight: settings.lineHeight,
              textAlign: settings.align,
            }}
          />
        ) : (
          <div
            className="mx-auto max-w-4xl px-6 py-[40vh] whitespace-pre-wrap"
            style={{
              color: settings.fontColor,
              fontFamily: settings.fontFamily,
              fontSize: settings.fontSize,
              lineHeight: settings.lineHeight,
              textAlign: settings.align,
            }}
          >
            {text}
          </div>
        )}
        <div
          className="pointer-events-none sticky bottom-0 z-10 h-32 bg-gradient-to-t from-current to-transparent"
          style={{ color: cameraFull ? "#000" : settings.bgColor }}
        />
        {/* Reading line guide */}
        <div className="pointer-events-none fixed left-0 right-0 top-1/2 -translate-y-1/2 mx-auto max-w-4xl px-6">
          <div className="h-px bg-white/10" />
        </div>
      </div>

      {/* Countdown overlay */}
      {countdown !== null && (
        <div className="absolute inset-0 z-40 grid place-items-center bg-black/70 backdrop-blur-sm">
          <div className="font-display text-[20vw] font-bold text-white animate-pulse">
            {countdown}
          </div>
        </div>
      )}

      {/* Bottom controls */}
      <div className="flex flex-wrap items-center justify-center gap-2 p-3 md:p-4 bg-black/40 backdrop-blur-md text-white">
        <button
          onClick={restart}
          title="Reiniciar do começo"
          className="rounded-xl bg-white/10 p-3 hover:bg-white/20"
        >
          <RotateCcw className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-1 rounded-xl bg-white/10 p-1">
          <button
            onClick={() => update({ speed: Math.max(5, settings.speed - 5) })}
            title="Mais devagar"
            className="rounded-lg p-2 hover:bg-white/20"
          >
            <ChevronDown className="h-5 w-5" />
          </button>
          <div className="px-2 text-xs font-mono min-w-[40px] text-center">{settings.speed}</div>
          <button
            onClick={() => update({ speed: Math.min(150, settings.speed + 5) })}
            title="Mais rápido"
            className="rounded-lg p-2 hover:bg-white/20"
          >
            <ChevronUp className="h-5 w-5" />
          </button>
        </div>

        <button
          onClick={() => setPlaying((p) => !p)}
          className="inline-flex items-center gap-2 rounded-2xl gradient-primary px-5 py-3 text-sm font-semibold shadow-glow hover:scale-105 transition-spring"
        >
          {playing ? (
            <>
              <Pause className="h-5 w-5" /> Pausar
            </>
          ) : (
            <>
              <Play className="h-5 w-5" /> Iniciar
            </>
          )}
        </button>

        <button
          onClick={() => (showCamera ? stopCamera() : startCamera())}
          className={`inline-flex items-center gap-2 rounded-xl px-3 py-3 text-sm font-medium transition-smooth ${showCamera ? "bg-primary/30" : "bg-white/10 hover:bg-white/20"}`}
        >
          <Camera className="h-5 w-5" /> {showCamera ? "Câmera ligada" : "Câmera"}
        </button>

        {recording && (
          <button
            onClick={togglePause}
            className="inline-flex items-center gap-2 rounded-xl bg-yellow-500/20 px-3 py-3 text-sm font-medium text-yellow-200 hover:bg-yellow-500/30"
          >
            {paused ? (
              <>
                <Play className="h-5 w-5" /> Retomar
              </>
            ) : (
              <>
                <Pause className="h-5 w-5" /> Pausar
              </>
            )}
          </button>
        )}

        <button
          onClick={toggleRecord}
          className={`inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-bold transition-spring hover:scale-105 ${recording ? "bg-red-600 text-white shadow-[0_0_30px_rgba(239,68,68,0.6)]" : "bg-red-500/90 text-white hover:bg-red-500"}`}
        >
          {recording ? (
            <>
              <Square className="h-5 w-5" /> Parar gravação
            </>
          ) : (
            <>
              <span className="h-3 w-3 rounded-full bg-white" /> Gravar vídeo
            </>
          )}
        </button>

        {lastUrl && !recording && (
          <>
            <button
              onClick={downloadLast}
              title="Baixar vídeo"
              className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 px-3 py-3 text-sm hover:bg-white/20"
            >
              <Download className="h-5 w-5" /> Baixar
            </button>
            <button
              onClick={shareLast}
              title="Compartilhar"
              className="rounded-xl bg-white/10 p-3 hover:bg-white/20"
            >
              <Share2 className="h-5 w-5" />
            </button>
          </>
        )}
      </div>

      {/* Help / quick guide overlay */}
      {showHelp && (
        <div
          className="absolute inset-0 z-50 grid place-items-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={dismissHelp}
        >
          <div
            className="max-w-md rounded-3xl border border-white/10 bg-background/95 p-6 text-foreground shadow-elevated animate-float-up"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-display text-2xl font-bold">Como usar o teleprompter</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Siga estes 3 passos simples para gravar seu vídeo lendo o roteiro.
            </p>
            <ol className="mt-5 space-y-4 text-sm">
              <li className="flex gap-3">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full gradient-primary font-bold text-primary-foreground">
                  1
                </span>
                <span>
                  <b>Toque em "Câmera"</b> para liberar o acesso. Sua imagem aparece no canto.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full gradient-primary font-bold text-primary-foreground">
                  2
                </span>
                <span>
                  <b>Toque em "Gravar vídeo"</b>. Após a contagem regressiva, uma{" "}
                  <span className="inline-flex items-center gap-1 rounded-full bg-red-600 px-2 py-0.5 text-xs font-semibold text-white">
                    <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                    REC
                  </span>{" "}
                  aparece e o texto começa a rolar.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full gradient-primary font-bold text-primary-foreground">
                  3
                </span>
                <span>
                  <b>Leia em voz alta</b> acompanhando o texto. Use ▲▼ para ajustar a velocidade.
                  Toque em <b>"Parar gravação"</b> ao terminar — seu vídeo fica salvo em{" "}
                  <b>Gravações</b>.
                </span>
              </li>
            </ol>
            <div className="mt-5 rounded-xl bg-secondary/60 p-3 text-xs text-muted-foreground">
              💡 Dica: toque no texto para pausar/continuar a rolagem. Tecla{" "}
              <kbd className="rounded bg-background px-1.5 py-0.5">Espaço</kbd> também funciona.
            </div>
            <button
              onClick={dismissHelp}
              className="mt-5 w-full rounded-xl gradient-primary px-4 py-3 font-semibold text-primary-foreground shadow-glow transition-spring hover:scale-[1.02]"
            >
              Entendi, vamos lá
            </button>
          </div>
        </div>
      )}

      {/* Settings panel */}
      {showSettings && (
        <div className="absolute right-3 top-20 z-40 w-[92vw] max-w-sm max-h-[75vh] overflow-y-auto overscroll-contain space-y-4 rounded-2xl border border-white/10 bg-background/95 p-5 text-foreground shadow-elevated backdrop-blur-xl animate-float-up">
          <div className="flex items-center justify-between">
            <h3 className="font-display font-semibold">Ajustes</h3>
            <button
              onClick={() => setShowSettings(false)}
              className="rounded-lg p-1 hover:bg-secondary"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <Slider
            label={`Tamanho da fonte (${settings.fontSize}px)`}
            min={20}
            max={140}
            step={2}
            value={settings.fontSize}
            onChange={(v) => update({ fontSize: v })}
          />
          <Slider
            label={`Espaçamento (${settings.lineHeight.toFixed(2)})`}
            min={1}
            max={2.5}
            step={0.05}
            value={settings.lineHeight}
            onChange={(v) => update({ lineHeight: v })}
          />
          <Slider
            label={`Velocidade (${settings.speed})`}
            min={5}
            max={150}
            step={1}
            value={settings.speed}
            onChange={(v) => update({ speed: v })}
          />

          <div>
            <label className="text-xs text-muted-foreground">Fonte</label>
            <select
              value={settings.fontFamily}
              onChange={(e) => update({ fontFamily: e.target.value })}
              className="mt-1 w-full rounded-lg border border-border bg-input px-3 py-2 text-sm"
            >
              {FONTS.map((f) => (
                <option key={f} value={f} style={{ fontFamily: f }}>
                  {f}
                </option>
              ))}
            </select>
          </div>

          <div>
            <p className="text-xs text-muted-foreground mb-2">Cor da fonte</p>
            <div className="flex flex-wrap gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => update({ fontColor: c })}
                  className={`h-8 w-8 rounded-lg border-2 transition-spring ${settings.fontColor === c ? "border-primary scale-110" : "border-white/20"}`}
                  style={{ background: c }}
                />
              ))}
              <input
                type="color"
                value={settings.fontColor}
                onChange={(e) => update({ fontColor: e.target.value })}
                className="h-8 w-8 cursor-pointer rounded-lg border border-border bg-transparent"
              />
            </div>
          </div>

          <div>
            <p className="text-xs text-muted-foreground mb-2">Cor de fundo</p>
            <div className="flex flex-wrap gap-2">
              {BG_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => update({ bgColor: c })}
                  className={`h-8 w-8 rounded-lg border-2 transition-spring ${settings.bgColor === c ? "border-primary scale-110" : "border-white/20"}`}
                  style={{ background: c }}
                />
              ))}
              <input
                type="color"
                value={settings.bgColor}
                onChange={(e) => update({ bgColor: e.target.value })}
                className="h-8 w-8 cursor-pointer rounded-lg border border-border bg-transparent"
              />
            </div>
          </div>

          <div>
            <p className="text-xs text-muted-foreground mb-2">Alinhamento</p>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  ["left", AlignLeft],
                  ["center", AlignCenter],
                  ["right", AlignRight],
                ] as const
              ).map(([a, Icon]) => (
                <button
                  key={a}
                  onClick={() => update({ align: a })}
                  className={`flex items-center justify-center rounded-lg border py-2 transition-smooth ${settings.align === a ? "border-primary bg-primary/20" : "border-border bg-secondary"}`}
                >
                  <Icon className="h-4 w-4" />
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs text-muted-foreground mb-2">Espelhar</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => update({ mirrorH: !settings.mirrorH })}
                className={`flex items-center justify-center gap-2 rounded-lg border py-2 text-sm ${settings.mirrorH ? "border-primary bg-primary/20" : "border-border bg-secondary"}`}
              >
                <FlipHorizontal className="h-4 w-4" /> H
              </button>
              <button
                onClick={() => update({ mirrorV: !settings.mirrorV })}
                className={`flex items-center justify-center gap-2 rounded-lg border py-2 text-sm ${settings.mirrorV ? "border-primary bg-primary/20" : "border-border bg-secondary"}`}
              >
                <FlipVertical className="h-4 w-4" /> V
              </button>
            </div>
          </div>

          <div>
            <p className="text-xs text-muted-foreground mb-2">Câmera</p>
            <div className="grid grid-cols-2 gap-2">
              {(["user", "environment"] as const).map((c) => (
                <button
                  key={c}
                  onClick={() => {
                    update({ camera: c });
                    if (showCamera) {
                      stopCamera();
                      setTimeout(startCamera, 100);
                    }
                  }}
                  className={`rounded-lg border py-2 text-xs font-medium ${settings.camera === c ? "border-primary bg-primary/20" : "border-border bg-secondary"}`}
                >
                  {c === "user" ? "Frontal" : "Traseira"}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs text-muted-foreground mb-2">Tamanho da câmera</p>
            <div className="grid grid-cols-4 gap-2">
              {(
                [
                  ["sm", "P"],
                  ["md", "M"],
                  ["lg", "G"],
                  ["full", "Tela cheia"],
                ] as const
              ).map(([v, label]) => (
                <button
                  key={v}
                  onClick={() => {
                    update({ cameraSize: v });
                    if (showCamera) {
                      setTimeout(() => {
                        if (videoRef.current && streamRef.current) {
                          videoRef.current.srcObject = streamRef.current;
                          videoRef.current.play().catch(() => {});
                        }
                      }, 50);
                    }
                  }}
                  className={`rounded-lg border py-2 text-xs font-medium ${settings.cameraSize === v ? "border-primary bg-primary/20" : "border-border bg-secondary"}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs text-muted-foreground mb-2">Resolução</p>
            <div className="grid grid-cols-3 gap-2">
              {(["720p", "1080p", "max"] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => update({ resolution: r })}
                  className={`rounded-lg border py-2 text-xs font-medium ${settings.resolution === r ? "border-primary bg-primary/20" : "border-border bg-secondary"}`}
                >
                  {r === "max" ? "Máx" : r}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs text-muted-foreground mb-2">Temporizador</p>
            <div className="grid grid-cols-4 gap-2">
              {([0, 3, 5, 10] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => update({ countdown: t })}
                  className={`rounded-lg border py-2 text-xs font-medium ${settings.countdown === t ? "border-primary bg-primary/20" : "border-border bg-secondary"}`}
                >
                  {t === 0 ? "Off" : `${t}s`}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={() => setMicOn((v) => !v)}
            className={`flex w-full items-center justify-center gap-2 rounded-lg border py-2 text-sm ${micOn ? "border-primary bg-primary/20" : "border-border bg-secondary"}`}
          >
            {micOn ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />} Microfone{" "}
            {micOn ? "ligado" : "desligado"}
          </button>

          <div className="rounded-xl border border-border bg-secondary/50 p-3 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">Controle remoto</p>
                <p className="text-xs text-muted-foreground">
                  Bluetooth via teclado/remoto + Wi-Fi via sessão remota.
                </p>
              </div>
              <span className="text-[11px] text-muted-foreground">{remoteStatus}</span>
            </div>

            {remoteMode === "off" ? (
              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  onClick={startRemoteHost}
                  className="rounded-lg bg-primary/20 px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/30"
                >
                  Abrir sessão remota
                </button>
                <button
                  onClick={startRemoteClient}
                  className="rounded-lg border border-border bg-secondary px-3 py-2 text-sm font-semibold hover:bg-secondary/70"
                >
                  Conectar sessão remota
                </button>
              </div>
            ) : null}

            {remoteMode === "host" ? (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Cole a resposta do controlador neste campo após ele gerar o código.
                </p>
                <textarea
                  readOnly
                  value={remoteOffer}
                  className="w-full min-h-[100px] rounded-xl border border-border bg-background p-3 text-xs text-foreground"
                  placeholder="Gerando código de sessão..."
                />
                <div className="flex flex-col gap-2 sm:flex-row">
                  <button
                    onClick={() => copyToClipboard(remoteOffer)}
                    disabled={!remoteOffer}
                    className="rounded-lg bg-primary/20 px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/30 disabled:opacity-50"
                  >
                    Copiar código
                  </button>
                </div>
                <textarea
                  value={remoteInput}
                  onChange={(e) => setRemoteInput(e.target.value)}
                  className="w-full min-h-[100px] rounded-xl border border-border bg-background p-3 text-xs text-foreground"
                  placeholder="Cole aqui a resposta do controlador"
                />
                <button
                  onClick={acceptRemoteAnswer}
                  className="rounded-lg bg-white/10 px-3 py-2 text-sm font-semibold hover:bg-white/20"
                >
                  Aplicar resposta
                </button>
              </div>
            ) : null}

            {remoteMode === "client" ? (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Cole o código de conexão do receiver e gere a resposta para enviar de volta.
                </p>
                <textarea
                  value={remoteInput}
                  onChange={(e) => setRemoteInput(e.target.value)}
                  className="w-full min-h-[100px] rounded-xl border border-border bg-background p-3 text-xs text-foreground"
                  placeholder="Cole aqui o código do receiver"
                />
                <button
                  onClick={acceptRemoteOffer}
                  className="rounded-lg bg-white/10 px-3 py-2 text-sm font-semibold hover:bg-white/20"
                >
                  Gerar resposta
                </button>
                {remoteAnswer ? (
                  <div className="space-y-2">
                    <textarea
                      readOnly
                      value={remoteAnswer}
                      className="w-full min-h-[100px] rounded-xl border border-border bg-background p-3 text-xs text-foreground"
                    />
                    <button
                      onClick={() => copyToClipboard(remoteAnswer)}
                      className="rounded-lg bg-primary/20 px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/30"
                    >
                      Copiar resposta
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}

            {remoteConnected && remoteMode === "client" ? (
              <div className="space-y-2 rounded-xl border border-primary/30 bg-primary/10 p-3">
                <p className="text-xs font-semibold text-primary">Controle remoto ativo</p>
                <div className="grid gap-2 sm:grid-cols-3">
                  <button
                    onClick={() => sendRemoteCommand({ action: "togglePlay" })}
                    className="rounded-lg border border-border bg-secondary px-3 py-2 text-sm font-semibold hover:bg-secondary/70"
                  >
                    Play/Pausa
                  </button>
                  <button
                    onClick={() => sendRemoteCommand({ action: "speed", delta: -5 })}
                    className="rounded-lg border border-border bg-secondary px-3 py-2 text-sm font-semibold hover:bg-secondary/70"
                  >
                    Mais devagar
                  </button>
                  <button
                    onClick={() => sendRemoteCommand({ action: "speed", delta: 5 })}
                    className="rounded-lg border border-border bg-secondary px-3 py-2 text-sm font-semibold hover:bg-secondary/70"
                  >
                    Mais rápido
                  </button>
                  <button
                    onClick={() => sendRemoteCommand({ action: "restart" })}
                    className="rounded-lg border border-border bg-secondary px-3 py-2 text-sm font-semibold hover:bg-secondary/70"
                  >
                    Reiniciar
                  </button>
                </div>
              </div>
            ) : null}

            {remoteError ? <p className="text-xs text-red-300">{remoteError}</p> : null}
            <p className="text-[11px] text-muted-foreground">
              Use Bluetooth como teclado sem fio (Space / ↑ / ↓) ou Wi‑Fi com sessão remota para
              controlar a rolagem.
            </p>
          </div>

          <div className="rounded-xl border border-border bg-secondary/50 p-3 space-y-3">
            <button
              onClick={() => update({ voicePause: !settings.voicePause })}
              className={`flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm font-medium ${settings.voicePause ? "border-primary bg-primary/20" : "border-border bg-secondary"}`}
            >
              <span className="flex items-center gap-2">
                <Mic className="h-4 w-4" /> Pausa por silêncio
              </span>
              <span
                className={`text-xs ${settings.voicePause ? "text-primary" : "text-muted-foreground"}`}
              >
                {settings.voicePause ? "ON" : "OFF"}
              </span>
            </button>
            <p className="text-[11px] text-muted-foreground -mt-1">
              Pausa a rolagem quando você para de falar e retoma ao detectar voz novamente. Requer
              microfone e câmera ligados.
            </p>
            {settings.voicePause && (
              <>
                <div>
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1">
                    <span>Nível do microfone</span>
                    <span className={voiceActive ? "text-primary" : ""}>
                      {voiceActive ? "voz" : "silêncio"}
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-background">
                    <div
                      className="h-full rounded-full bg-primary transition-[width] duration-75"
                      style={{ width: `${Math.min(100, voiceLevel)}%` }}
                    />
                  </div>
                  <div className="relative h-0">
                    <div
                      className="absolute -top-1.5 h-1.5 w-px bg-yellow-400"
                      style={{ left: `${settings.voiceThreshold}%` }}
                    />
                  </div>
                </div>
                <Slider
                  label={`Sensibilidade (${settings.voiceThreshold})`}
                  min={2}
                  max={60}
                  step={1}
                  value={settings.voiceThreshold}
                  onChange={(v) => update({ voiceThreshold: v })}
                />
                <Slider
                  label={`Tempo de silêncio (${(settings.voiceSilenceMs / 1000).toFixed(1)}s)`}
                  min={300}
                  max={4000}
                  step={100}
                  value={settings.voiceSilenceMs}
                  onChange={(v) => update({ voiceSilenceMs: v })}
                />
              </>
            )}
          </div>
        </div>
      )}

      {pendingRec && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-zinc-950 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="relative">
              <video src={pendingRec.url} controls className="aspect-video w-full bg-black" />
              <div className="absolute right-3 top-3 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur">
                {`${String(Math.floor(pendingRec.duration / 60)).padStart(2, "0")}:${String(pendingRec.duration % 60).padStart(2, "0")}`}
                {" · "}
                {pendingRec.blob.size > 1e6
                  ? `${(pendingRec.blob.size / 1e6).toFixed(1)} MB`
                  : `${(pendingRec.blob.size / 1e3).toFixed(0)} KB`}
              </div>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <h3 className="font-display text-lg font-semibold text-white">
                  Gravação concluída
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">Salve no seu dispositivo.</p>
              </div>
              <div className="grid grid-cols-1 gap-2">
                <button
                  onClick={async () => {
                    const isMp4 = pendingRec.blob.type.includes("mp4");
                    const ext = isMp4 ? "mp4" : "webm";
                    const filename = `prompter-${Date.now()}.${ext}`;
                    const isIOS =
                      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
                      (navigator.platform === "MacIntel" &&
                        navigator.maxTouchPoints > 1);

                    try {
                      // Prefer File System Access API when available (desktop / Android Chromium)
                      if ((window as any).showSaveFilePicker) {
                        // @ts-ignore
                        const handle = await (window as any).showSaveFilePicker({
                          suggestedName: filename,
                          types: [
                            {
                              description: "Video file",
                              accept: { [pendingRec.blob.type]: [`.${ext}`] },
                            },
                          ],
                        });
                        const writable = await handle.createWritable();
                        await writable.write(pendingRec.blob);
                        await writable.close();
                        toast.success("Vídeo salvo no dispositivo.");
                      } else {
                        const file = new File([pendingRec.blob], filename, {
                          type: pendingRec.blob.type,
                        });
                        const canShareFiles = (navigator as any).canShare?.({ files: [file] });
                        // On iOS there's no programmatic save to Photos — open the video so the user can long-press and save
                        if (isIOS) {
                          window.open(pendingRec.url, "_blank");
                          toast.message("Toque e segure no vídeo e escolha 'Salvar em Vídeos'.");
                          return; // keep modal open so URL stays valid
                        }
                        // If Web Share with files is available, use it only if user agent supports sharing to gallery (best-effort)
                        if (canShareFiles && (navigator as any).share) {
                          await (navigator as any).share({
                            files: [file],
                            title: script?.title || "Prompter.io",
                          });
                          toast.success("Vídeo compartilhado.");
                        } else {
                          // Fallback to anchor download (desktop browsers)
                          const a = document.createElement("a");
                          a.href = pendingRec.url;
                          a.download = filename;
                          a.click();
                          toast.success("Vídeo salvo no dispositivo.");
                        }
                      }
                    } catch (err: any) {
                      // Fallback: anchor download
                      const a = document.createElement("a");
                      a.href = pendingRec.url;
                      a.download = filename;
                      a.click();
                    }
                    URL.revokeObjectURL(pendingRec.url);
                    setPendingRec(null);
                    setLastUrl(null);
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-xl gradient-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-glow transition-spring hover:scale-[1.02]"
                >
                  <Download className="h-4 w-4" /> Salvar no dispositivo
                </button>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      if (!confirm("Excluir gravação?")) return;
                      URL.revokeObjectURL(pendingRec.url);
                      setPendingRec(null);
                      setLastUrl(null);
                      toast.success("Gravação excluída.");
                    }}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm font-medium text-red-300 transition-smooth hover:bg-red-500/20"
                  >
                    <Square className="h-4 w-4" /> Excluir
                  </button>
                  <button
                    onClick={() => setPendingRec(null)}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-zinc-200 transition-smooth hover:bg-white/10"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Slider({
  label,
  min,
  max,
  step,
  value,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <label className="text-xs text-muted-foreground">{label}</label>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="mt-1 w-full accent-primary"
      />
    </div>
  );
}
