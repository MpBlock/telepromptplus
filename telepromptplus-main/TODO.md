# TODO - Limpa e refactor (sem quebrar funcionalidades)

- [ ] Auditar `Prompter.tsx` para remover imports/refs/states não usados e extrair helpers puros
- [ ] Garantir cleanup de `URL.createObjectURL` sem mudar fluxo atual
- [ ] Refactor mantendo comportamento idêntico (câmera, gravação, pausa/retoma por voz, remote WebRTC, overlays)
- [ ] Ajustar `AppShell.tsx` para evitar duplicidade/instância redundante do `<Toaster />` sem mudar UI
- [ ] Rodar `npm run lint` e `npm run build`
- [ ] Revisar manualmente os fluxos principais no navegador
