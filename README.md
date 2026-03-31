# IPv6 Helper

Uma ferramenta web completa para administração e planejamento de redes IPv6.

## Funcionalidades

- **Calculadora de Sub-redes** — Divide blocos IPv6 em sub-redes, com exportação em CSV, Excel, TXT e JSON
- **DNS Lookup** — Resolução de nomes DNS para endereços IPv6
- **Teste de Rede (Ping)** — Verifica a conectividade IPv6
- **Verificador de Prontidão IPv6** — Testa se sistemas e redes estão prontos para IPv6
- **Conversão IPv4 → IPv6** — Converte endereços entre os dois protocolos
- **Zona PTR (DNS Reverso)** — Gera arquivos de zona reversa para IPv6
- **Domínios no IP** — Lookup reverso de IP para domínios
- **Detecção de Sobreposição** — Identifica sub-redes IPv6 sobrepostas
- **Planejador de Redes** — Auxilia no design e alocação de espaços de endereçamento IPv6
- **EUI-64 / SLAAC** — Gera endereços IPv6 a partir de endereços MAC
- **Histórico** — Mantém registro das operações realizadas

## Tecnologias

- [React](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- [Vite](https://vitejs.dev/)
- [Tailwind CSS](https://tailwindcss.com/)
- [shadcn/ui](https://ui.shadcn.com/)
- [React Router](https://reactrouter.com/)
- [TanStack Query](https://tanstack.com/query)
- [Framer Motion](https://www.framer.com/motion/)

## Como executar localmente

Requisito: [Node.js](https://nodejs.org/) instalado.

```sh
# 1. Clone o repositório
git clone https://github.com/CarHen17/ipv6-helper.git

# 2. Acesse o diretório
cd ipv6-helper

# 3. Instale as dependências
npm install

# 4. Inicie o servidor de desenvolvimento
npm run dev
```

O app estará disponível em `http://localhost:5173`.

## Scripts disponíveis

| Comando | Descrição |
|---|---|
| `npm run dev` | Inicia o servidor de desenvolvimento |
| `npm run build` | Gera o build de produção |
| `npm run preview` | Pré-visualiza o build de produção |
| `npm run lint` | Executa o linter |
| `npm run test` | Executa os testes unitários |
| `npm run test:e2e` | Executa os testes E2E com Playwright |
