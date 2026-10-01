import type { IncomingMessage, ServerResponse } from 'node:http';
import { loadEnv, type Plugin, type ViteDevServer } from 'vite';

/**
 * As rotas em /api são Vercel Serverless Functions — só existem de verdade
 * via `vercel dev` ou já implantadas. Este plugin faz o próprio servidor de
 * dev do Vite executar essas funções em `npm run dev`, para não depender da
 * Vercel CLI só para testar localmente. Nunca roda em build/produção
 * (`apply: 'serve'`) — lá quem serve /api é a Vercel de verdade.
 */
const ROTAS_API: Record<string, string> = {
  '/api/sync/dispatch': '/api/sync/dispatch.ts',
  '/api/export/pdf': '/api/export/pdf.ts',
  '/api/manifest': '/api/manifest.ts',
  '/api/integrations/save-credentials': '/api/integrations/save-credentials.ts',
  '/api/integrations/list-assets': '/api/integrations/list-assets.ts',
  '/api/integrations/save-assets': '/api/integrations/save-assets.ts',
  '/api/webhooks/rd-station': '/api/webhooks/rd-station.ts',
  '/api/integrations/rd-station-diagnostico': '/api/integrations/rd-station-diagnostico.ts',
  '/api/integrations/rd-station-links': '/api/integrations/rd-station-links.ts',
};

function lerCorpoBruto(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const partes: Buffer[] = [];
    req.on('data', (parte: Buffer) => partes.push(parte));
    req.on('end', () => resolve(Buffer.concat(partes).toString('utf-8')));
    req.on('error', reject);
  });
}

interface RespostaEstiloVercel extends ServerResponse {
  status: (codigo: number) => RespostaEstiloVercel;
  json: (corpo: unknown) => void;
  send: (corpo: unknown) => void;
}

function criarRespostaEstiloVercel(res: ServerResponse): RespostaEstiloVercel {
  const resposta = res as RespostaEstiloVercel;

  resposta.status = (codigo: number) => {
    res.statusCode = codigo;
    return resposta;
  };

  resposta.json = (corpo: unknown) => {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(corpo));
  };

  resposta.send = (corpo: unknown) => {
    if (Buffer.isBuffer(corpo) || typeof corpo === 'string') {
      res.end(corpo);
    } else if (corpo !== undefined) {
      resposta.json(corpo);
    } else {
      res.end();
    }
  };

  return resposta;
}

export function apiDevMiddleware(): Plugin {
  return {
    name: 'apontaads-api-dev-middleware',
    apply: 'serve',
    configureServer(server: ViteDevServer) {
      // Vite só expõe em import.meta.env (client) as variáveis com prefixo
      // VITE_ — SUPABASE_SERVICE_ROLE_KEY e CRON_SECRET nunca aparecem em
      // process.env sozinhas. loadEnv(..., '') lê o .env/.env.local sem
      // filtro de prefixo, para as funções (que leem process.env, igual à
      // Vercel real) funcionarem também em dev.
      const envCarregado = loadEnv(server.config.mode, server.config.root, '');
      for (const [chave, valor] of Object.entries(envCarregado)) {
        if (process.env[chave] === undefined) process.env[chave] = valor;
      }

      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url ?? '', 'http://localhost');
        const caminhoArquivo = ROTAS_API[url.pathname];

        if (!caminhoArquivo) {
          next();
          return;
        }

        try {
          const modulo = await server.ssrLoadModule(caminhoArquivo);
          const handler = modulo.default as (req: unknown, res: unknown) => Promise<void>;

          const corpoTexto = await lerCorpoBruto(req);
          const requisicao = Object.assign(req, {
            query: Object.fromEntries(url.searchParams),
            body: corpoTexto ? JSON.parse(corpoTexto) : undefined,
          });

          await handler(requisicao, criarRespostaEstiloVercel(res));
        } catch (erro) {
          console.error(`[api-dev-middleware] Erro ao executar ${caminhoArquivo}:`, erro);
          if (!res.headersSent) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Erro interno ao executar a função local' }));
          }
        }
      });
    },
  };
}
