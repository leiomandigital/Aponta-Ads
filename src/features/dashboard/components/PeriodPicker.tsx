import { useState } from 'react';
import type { DateRange } from 'react-day-picker';
import { Check, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { formatarData } from '@/utils/formatters';
import { PERIODOS_DASHBOARD, type PeriodoDashboard } from '@/constants/dashboard.constants';
import type { IntervaloPersonalizado } from '../hooks/useDashboardMetrics';

interface PeriodPickerProps {
  periodo: PeriodoDashboard;
  intervaloPersonalizado: IntervaloPersonalizado | null;
  aoSelecionarPreset: (periodo: PeriodoDashboard) => void;
  aoAplicarIntervaloPersonalizado: (intervalo: IntervaloPersonalizado) => void;
}

export function PeriodPicker({
  periodo,
  intervaloPersonalizado,
  aoSelecionarPreset,
  aoAplicarIntervaloPersonalizado,
}: PeriodPickerProps) {
  const [aberto, setAberto] = useState(false);
  const [rangeEmEdicao, setRangeEmEdicao] = useState<DateRange | undefined>(
    intervaloPersonalizado ? { from: intervaloPersonalizado.inicio, to: intervaloPersonalizado.fim } : undefined
  );

  const rotulo =
    periodo === 'custom' && intervaloPersonalizado
      ? `${formatarData(intervaloPersonalizado.inicio)} - ${formatarData(intervaloPersonalizado.fim)}`
      : PERIODOS_DASHBOARD.find((item) => item.valor === periodo)?.rotulo ?? 'Período';

  const handleSelecionarPreset = (valor: PeriodoDashboard) => {
    aoSelecionarPreset(valor);
    setAberto(false);
  };

  const handleAplicarPersonalizado = () => {
    if (!rangeEmEdicao?.from || !rangeEmEdicao?.to) return;
    aoAplicarIntervaloPersonalizado({ inicio: rangeEmEdicao.from, fim: rangeEmEdicao.to });
    setAberto(false);
  };

  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-[160px] justify-between font-normal sm:w-[220px]">
          <span className="truncate">{rotulo}</span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="end">
        <div className="flex flex-col p-1">
          {PERIODOS_DASHBOARD.map((item) => (
            <button
              key={item.valor}
              type="button"
              onClick={() => handleSelecionarPreset(item.valor)}
              className={cn(
                'flex items-center justify-between rounded-sm px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground',
                periodo === item.valor && 'font-semibold'
              )}
            >
              {item.rotulo}
              {periodo === item.valor && <Check className="h-4 w-4" />}
            </button>
          ))}
        </div>
        <Separator />
        <div className="flex flex-col gap-2 p-3">
          <span className="text-xs font-medium text-muted-foreground">Período personalizado</span>
          <Calendar
            mode="range"
            selected={rangeEmEdicao}
            onSelect={setRangeEmEdicao}
            numberOfMonths={1}
            disabled={{ after: new Date() }}
            defaultMonth={intervaloPersonalizado?.fim ?? new Date()}
          />
          <Button size="sm" onClick={handleAplicarPersonalizado} disabled={!rangeEmEdicao?.from || !rangeEmEdicao?.to}>
            Aplicar período personalizado
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
