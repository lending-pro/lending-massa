import { useState } from 'react';

interface TokenIconProps {
  symbol: string;
  logo?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  sm: 'w-6 h-6 text-xs',
  md: 'w-8 h-8 text-sm',
  lg: 'w-10 h-10 text-base',
};

export default function TokenIcon({ symbol, logo, size = 'md', className = '' }: TokenIconProps) {
  const [imageError, setImageError] = useState(false);
  const sizeClass = sizeClasses[size];

  if (logo && !imageError) {
    return (
      <img
        src={logo}
        alt={symbol}
        className={`${sizeClass} rounded-full object-cover bg-slate-700 ${className}`}
        onError={() => setImageError(true)}
      />
    );
  }

  // Fallback: gradient with first letter
  return (
    <div className={`${sizeClass} bg-gradient-to-br from-primary-500 to-primary-700 rounded-full flex items-center justify-center ${className}`}>
      <span className="font-bold text-white">{symbol[0]}</span>
    </div>
  );
}
