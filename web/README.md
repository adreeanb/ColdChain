# ColdChain Monitor (web)

Aplicação web responsiva para acompanhar temperaturas, tratar alertas e vincular placas ESP32 por QR Code. Consome a API da pasta `../api`.

## Como rodar

1. Suba o banco e a API em `../api` (`docker compose up -d` e `npm run dev`).
2. Aqui, instale as dependências e crie o arquivo de ambiente:

   ```bash
   npm install
   cp .env.example .env
   ```

3. Ajuste `API_PROXY_TARGET` no `.env` para a porta da API.
4. Rode `npm run dev` e abra http://localhost:5173. O usuário MASTER inicial vem do seed da API.

## Usar a câmera no celular

O navegador só libera a câmera em HTTPS. Com o celular na mesma rede:

```bash
npm run dev:https
```

Abra `https://<ip-do-computador>:5173` no celular e aceite o aviso do certificado de desenvolvimento.

## Testes

```bash
npm test            # unidade e integração
npm run test:e2e    # fluxo completo; na primeira vez, rode npx playwright install chromium
```

O teste de ponta a ponta usa a API e o Postgres locais e cria empresas com o nome `e2e-*`, que não são apagadas ao final.

## Produção

Rode `npm run build` e sirva a pasta `dist/` em HTTPS, com fallback das rotas para `index.html` e a API em `/api`. Sem esse proxy, defina `VITE_API_URL` no build e inclua a origem do site em `CORS_ORIGINS` na API.
