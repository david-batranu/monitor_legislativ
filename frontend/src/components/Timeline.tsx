import { StatusHistoryEntry } from '../types';
import { format, parseISO } from 'date-fns';
import { cn } from '../lib/utils';
import { CheckCircle2, Clock, AlertCircle } from 'lucide-react';

interface TimelineProps {
  history?: StatusHistoryEntry[];
}

const getStatusColor = (status: string) => {
  const s = status.toLowerCase();
  if (s.includes('promulgare') || s.includes('adoptat') || s.includes('aprobat')) {
    return 'text-success bg-success/10 border-success/20';
  }
  if (s.includes('respins') || s.includes('retras') || s.includes('neconstituțional')) {
    return 'text-danger bg-danger/10 border-danger/20';
  }
  return 'text-warning bg-warning/10 border-warning/20';
};

const getStatusIcon = (status: string) => {
  const s = status.toLowerCase();
  if (s.includes('promulgare') || s.includes('adoptat') || s.includes('aprobat')) {
    return <CheckCircle2 className="w-5 h-5" />;
  }
  if (s.includes('respins') || s.includes('retras') || s.includes('neconstituțional')) {
    return <AlertCircle className="w-5 h-5" />;
  }
  return <Clock className="w-5 h-5" />;
};

export const Timeline = ({ history }: TimelineProps) => {
  if (!history || history.length === 0) {
    return <div className="text-textSecondary text-sm italic">Nu există istoric disponibil.</div>;
  }

  // Sort by timestamp descending
  const sortedHistory = [...history].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return (
    <div className="relative border-l border-surface/50 ml-3 space-y-6">
      {sortedHistory.map((entry, index) => {
        const colorClass = getStatusColor(entry.statusLabel);
        
        return (
          <div key={index} className="relative pl-6">
            <div className={cn(
              "absolute -left-3.5 top-1 p-1 rounded-full border bg-background",
              colorClass
            )}>
              {getStatusIcon(entry.statusLabel)}
            </div>
            
            <div className="flex flex-col gap-1">
              <span className={cn("text-sm font-medium", colorClass.split(' ')[0])}>
                {entry.statusLabel}
              </span>
              <div className="flex items-center gap-2 text-xs text-textSecondary">
                <time dateTime={entry.timestamp}>
                  {format(parseISO(entry.timestamp), 'dd MMM yyyy')}
                </time>
                {entry.location && (
                  <>
                    <span>&bull;</span>
                    <span>{entry.location}</span>
                  </>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
