'use client';

interface ChartProps {
  data: {
    name: string;
    esperado: number;
    recebido: number;
  }[];
}

export default function DashboardChart({ data }: ChartProps) {
  if (!data || data.length === 0) return null;

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(val);
  };

  const maxVal = Math.max(...data.map(d => Math.max(d.esperado, d.recebido)));
  const yAxisTicks = [maxVal, maxVal * 0.75, maxVal * 0.5, maxVal * 0.25, 0];

  return (
    <div className="w-full h-full flex flex-col pt-4">
      <div className="flex-1 flex relative">
        {/* Y Axis */}
        <div className="w-16 flex flex-col justify-between text-[10px] text-slate-400 pr-2 pb-6 border-r border-slate-100">
          {yAxisTicks.map((tick, i) => (
            <div key={i} className="text-right -mt-2">
              R$ {(tick / 1000).toFixed(0)}k
            </div>
          ))}
        </div>

        {/* Chart Area */}
        <div className="flex-1 flex items-end justify-between px-4 pb-6 relative">
          {/* Grid lines */}
          <div className="absolute inset-0 flex flex-col justify-between pb-6 pointer-events-none">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="w-full h-px bg-slate-50"></div>
            ))}
          </div>

          {/* Bars */}
          {data.map((item, i) => {
            const hEsperado = maxVal > 0 ? (item.esperado / maxVal) * 100 : 0;
            const hRecebido = maxVal > 0 ? (item.recebido / maxVal) * 100 : 0;
            return (
              <div key={i} className="flex flex-col items-center justify-end h-full w-full group relative z-10 px-1 sm:px-2">
                <div className="flex items-end justify-center w-full gap-0.5 sm:gap-1 h-full">
                  <div 
                    style={{ height: `${hEsperado}%` }} 
                    className="w-1/2 max-w-[20px] bg-indigo-200 rounded-t-sm transition-all duration-500 group-hover:bg-indigo-300"
                  ></div>
                  <div 
                    style={{ height: `${hRecebido}%` }} 
                    className="w-1/2 max-w-[20px] bg-emerald-400 rounded-t-sm transition-all duration-500 group-hover:bg-emerald-500"
                  ></div>
                </div>

                {/* X Axis Label */}
                <div className="absolute -bottom-6 text-[10px] text-slate-400 whitespace-nowrap">
                  {item.name}
                </div>

                {/* Tooltip on Hover */}
                <div className="absolute bottom-full mb-2 bg-slate-800 text-white text-xs rounded-lg p-3 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 w-max left-1/2 -translate-x-1/2 flex flex-col gap-1">
                  <p className="font-bold border-b border-slate-600 pb-1 mb-1">{item.name}</p>
                  <p className="flex justify-between gap-4"><span className="text-indigo-200">Esperado:</span> <span>{formatCurrency(item.esperado)}</span></p>
                  <p className="flex justify-between gap-4"><span className="text-emerald-400">Recebido:</span> <span>{formatCurrency(item.recebido)}</span></p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      
      {/* Legend */}
      <div className="flex justify-center gap-6 mt-4 pt-4 border-t border-slate-100">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-indigo-200 rounded-full"></div>
          <span className="text-xs text-slate-500 font-medium">Valor Esperado</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-emerald-400 rounded-full"></div>
          <span className="text-xs text-slate-500 font-medium">Valor Recebido</span>
        </div>
      </div>
    </div>
  );
}
