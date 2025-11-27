interface HealthFactorGaugeProps {
  healthFactor: string;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

export default function HealthFactorGauge({
  healthFactor,
  size = 'md',
  showLabel = true
}: HealthFactorGaugeProps) {
  const isInfinity = healthFactor === '∞';
  const hfValue = isInfinity ? 10 : parseFloat(healthFactor);

  // Clamp value for display (0 to 3+ shows full gauge)
  const displayValue = Math.min(Math.max(hfValue, 0), 3);
  const percentage = (displayValue / 3) * 100;

  // Determine color based on health factor
  const getColor = () => {
    if (isInfinity) return { bg: 'bg-green-500', text: 'text-green-400', gradient: 'from-green-500 to-green-400' };
    if (hfValue >= 1.5) return { bg: 'bg-green-500', text: 'text-green-400', gradient: 'from-green-500 to-green-400' };
    if (hfValue >= 1.2) return { bg: 'bg-yellow-500', text: 'text-yellow-400', gradient: 'from-yellow-500 to-yellow-400' };
    if (hfValue >= 1.0) return { bg: 'bg-orange-500', text: 'text-orange-400', gradient: 'from-orange-500 to-orange-400' };
    return { bg: 'bg-red-500', text: 'text-red-400', gradient: 'from-red-500 to-red-400' };
  };

  const colors = getColor();

  // Status text
  const getStatus = () => {
    if (isInfinity) return 'No Debt';
    if (hfValue >= 1.5) return 'Healthy';
    if (hfValue >= 1.2) return 'Moderate Risk';
    if (hfValue >= 1.0) return 'High Risk';
    return 'Liquidatable';
  };

  // Size classes
  const sizeClasses = {
    sm: { container: 'w-24 h-24', text: 'text-lg', label: 'text-xs', status: 'text-[10px]' },
    md: { container: 'w-32 h-32', text: 'text-2xl', label: 'text-sm', status: 'text-xs' },
    lg: { container: 'w-40 h-40', text: 'text-3xl', label: 'text-base', status: 'text-sm' },
  };

  const classes = sizeClasses[size];

  return (
    <div className="flex flex-col items-center">
      {/* Circular Gauge */}
      <div className={`relative ${classes.container}`}>
        {/* Background circle */}
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
          {/* Background arc */}
          <circle
            cx="50"
            cy="50"
            r="42"
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            className="text-slate-700"
            strokeLinecap="round"
            strokeDasharray="198 264"
          />
          {/* Progress arc */}
          <circle
            cx="50"
            cy="50"
            r="42"
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            className={colors.text}
            strokeLinecap="round"
            strokeDasharray={`${percentage * 1.98} 264`}
            style={{ transition: 'stroke-dasharray 0.5s ease' }}
          />
        </svg>

        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`font-bold ${colors.text} ${classes.text}`}>
            {isInfinity ? '∞' : hfValue.toFixed(2)}
          </span>
          {showLabel && (
            <span className={`text-slate-400 ${classes.status} mt-0.5`}>
              {getStatus()}
            </span>
          )}
        </div>
      </div>

      {/* Risk zones legend */}
      <div className="flex items-center gap-2 mt-3 text-[10px]">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-red-500"></div>
          <span className="text-slate-500">&lt;1.0</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-orange-500"></div>
          <span className="text-slate-500">1.0-1.2</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
          <span className="text-slate-500">1.2-1.5</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-green-500"></div>
          <span className="text-slate-500">&gt;1.5</span>
        </div>
      </div>
    </div>
  );
}
