import { Svg, Path } from '@react-pdf/renderer';
// Import relativo (não @/) — alcançado pelo bundler serverless da Vercel a
// partir de api/export/pdf.ts, ver ReportDocument.tsx.
import { DADOS_ICONE_PLATAFORMA } from '../../../components/shared/icons/platformIconData.js';
import type { IntegrationKey } from '../../../types/database.types.js';

interface PlatformIconPdfProps {
  plataforma: IntegrationKey;
  size?: number;
}

/**
 * Mesma logo de PlatformIcon.tsx (web), redesenhada com os primitivos Svg/Path
 * do @react-pdf/renderer — não é possível reaproveitar o componente web
 * porque ele usa <svg>/<path> do react-dom, que o react-pdf não sabe renderizar.
 * Os dados do desenho (viewBox/fill/d) vêm da mesma fonte única.
 */
export function PlatformIconPdf({ plataforma, size = 10 }: PlatformIconPdfProps) {
  const dados = DADOS_ICONE_PLATAFORMA[plataforma];
  return (
    <Svg viewBox={dados.viewBox} style={{ width: size, height: size }}>
      <Path d={dados.d} fill={dados.fill} />
    </Svg>
  );
}
