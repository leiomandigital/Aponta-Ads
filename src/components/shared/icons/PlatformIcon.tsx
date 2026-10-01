import type { SVGProps } from 'react';
import type { IntegrationKey } from '@/types/database.types';
import { DADOS_ICONE_PLATAFORMA, ROTULO_PLATAFORMA } from './platformIconData';

interface PlatformIconProps extends Omit<SVGProps<SVGSVGElement>, 'ref'> {
  plataforma: IntegrationKey;
}

/**
 * Logo da integração (Google Ads, Google Analytics, Meta Ads ou RD Station)
 * como SVG inline — desenho vem de platformIconData.ts, fonte única
 * compartilhada com PlatformIconPdf.tsx (relatório em PDF).
 */
export function PlatformIcon({ plataforma, className, ...props }: PlatformIconProps) {
  const dados = DADOS_ICONE_PLATAFORMA[plataforma];
  return (
    <svg viewBox={dados.viewBox} xmlns="http://www.w3.org/2000/svg" role="img" aria-label={ROTULO_PLATAFORMA[plataforma]} className={className} {...props}>
      <path fill={dados.fill} d={dados.d} />
    </svg>
  );
}
