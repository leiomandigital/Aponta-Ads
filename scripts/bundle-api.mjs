import * as esbuild from 'esbuild';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Por que este script existe: o rastreador de arquivos da Vercel (@vercel/nft) não
// consegue resolver um import relativo com extensão ".js" quando o arquivo de origem
// real é ".ts"/".tsx" (ex.: './ReportDocument.js' apontando para 'ReportDocument.tsx')
// — ele tenta 'ReportDocument.js.ts', 'ReportDocument.js.tsx', nunca 'ReportDocument.tsx'.
// Isso derruba em produção qualquer função de /api que importe outro arquivo do projeto,
// com "Cannot find module" (confirmado lendo o código-fonte do @vercel/nft e reproduzindo
// o erro real). A saída é empacotar cada função num único arquivo autocontido antes do
// deploy — sem imports relativos sobrando, só pacotes de node_modules (resolução que
// funciona normalmente). Rodar com: npm run build:api

const raizProjeto = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..');

const FUNCOES = [
  'api/sync/dispatch.ts',
  'api/integrations/save-credentials.ts',
  'api/integrations/list-assets.ts',
  'api/integrations/save-assets.ts',
  'api/export/pdf.ts',
];

/** Marca qualquer import que não comece com "." ou "/" como externo (pacotes do node_modules). */
const externalizarPacotes = {
  name: 'externalizar-pacotes',
  setup(build) {
    build.onResolve({ filter: /^[^./]/ }, (args) => {
      if (args.kind === 'entry-point') return null; // deixa o esbuild resolver o próprio arquivo de entrada
      return { path: args.path, external: true };
    });
  },
};

// outDir já inclui o prefixo "api" de propósito: o conteúdo de api-bundled/api
// é exatamente o que deve SUBSTITUIR a pasta api/ inteira no upload para a
// Vercel (ver README do deploy) — copiar a pasta toda, sem escolher arquivo
// por arquivo, evita deixar sobra do .ts original misturada com o .js gerado.
export async function empacotarFuncoesApi({ outDir = 'api-bundled/api', write = true } = {}) {
  const resultados = [];

  for (const entrada of FUNCOES) {
    const relativoSemExtensao = entrada.replace(/^api\//, '').replace(/\.ts$/, '.js');
    const outfile = path.join(raizProjeto, outDir, relativoSemExtensao);

    const resultado = await esbuild.build({
      entryPoints: [path.join(raizProjeto, entrada)],
      absWorkingDir: raizProjeto,
      bundle: true,
      platform: 'node',
      format: 'esm',
      target: 'node20',
      jsx: 'automatic',
      outfile,
      write,
      plugins: [externalizarPacotes],
      logLevel: 'silent',
    });

    resultados.push({ entrada, outfile, resultado });
  }

  return resultados;
}

// Executado diretamente (não importado por outro script): empacota e imprime o resumo.
if (import.meta.url === `file://${process.argv[1]}`.replace(/\\/g, '/') || import.meta.url === `file:///${process.argv[1]}`.replace(/\\/g, '/')) {
  const resultados = await empacotarFuncoesApi();
  for (const { entrada, outfile } of resultados) {
    console.log(`${entrada} -> ${path.relative(raizProjeto, outfile)}`);
  }
}
