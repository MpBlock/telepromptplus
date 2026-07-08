# Como hospedar no Vercel (Static) - TelepromptPlus (Vite)

## 1) O Vercel pode ser apenas static?
- **Depende de como as “funções” funcionam.**
- O seu projeto hoje roda com **Vite + React (SPA)** e tem um `src/server.ts` que só faz **servir o build** (`dist/client`).
- No Vercel, o equivalente é hospedar **o build estático** do Vite.

## 2) Pré-requisito
- O app precisa funcionar sem chamadas para um backend próprio.
- As “funções” (ex: buscar scripts, salvar em algum storage, etc.) precisam estar implementadas no **frontend** ou usando serviços externos (ex: banco/URL que não depende do Express local).

## 3) Configurar build estático no Vercel
- No projeto Vercel, escolha:
  - **Framework preset:** Vite
  - **Build command:** `npm run build`
  - **Output directory:** `dist/client`

## 4) Ajuste importante no seu `index.html`
Hoje o `index.html` está referenciando um CSS de `src/styles.css`:
- `<link rel="stylesheet" href="/src/styles.css" />`

Em produção (principalmente static), `src/styles.css` **não existe** como arquivo público.

✅ Solução: deixe o CSS entrar via bundler (no Vite) **ou** aponte para o arquivo gerado pelo build.

### Opção A (recomendada): importar o CSS no entry do React
1. Remover o `<link ... href="/src/styles.css" />` do `index.html`
2. No `src/entry-client.tsx`, adicionar `import "./styles.css"`

## 5) Como testar localmente antes
- Rodar `npm run build`
- Servir o conteúdo gerado (o equivalente do Vercel) e garantir que:
  - rotas funcionam (SPA)
  - assets carregam (CSS/JS)

