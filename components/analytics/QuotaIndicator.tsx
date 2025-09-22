'use client';

interface QuotaIndicatorProps {
  used: number;
  limit: number;
  label: string;
  className?: string;
}

export default function QuotaIndicator({ used, limit, label, className = '' }: QuotaIndicatorProps) {
  const percentage = Math.min((used / limit) * 100, 100);
  const isNearLimit = percentage >= 80;
  const isOverLimit = used > limit;

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex justify-between items-center">
        <span className="text-sm font-medium">{label}</span>
        <span className={`text-sm ${isOverLimit ? 'text-red-600' : isNearLimit ? 'text-yellow-600' : 'text-gray-600'}`}>
          {used.toLocaleString()} / {limit.toLocaleString()}
        </span>
      </div>

      <div className="w-full bg-gray-200 rounded-full h-3">
        <div
          className={`h-3 rounded-full transition-all duration-300 ${
            isOverLimit
              ? 'bg-red-600'
              : isNearLimit
              ? 'bg-yellow-600'
              : 'bg-blue-600'
          }`}
          style={{ width: `${percentage}%` }}
        ></div>
      </div>

      <div className="text-xs text-gray-500">
        {percentage.toFixed(1)}% used
        {isNearLimit && !isOverLimit && (
          <span className="text-yellow-600 ml-1">• Approaching limit</span>
        )}
        {isOverLimit && (
          <span className="text-red-600 ml-1">• Over limit</span>
        )}
      </div>
    </div>
  );
}