import { LegislativeJSON } from '../types';
import { Timeline } from './Timeline';
import { Building2, ExternalLink, FileText } from 'lucide-react';
import { cn } from '../lib/utils';

interface LawCardProps {
  data: LegislativeJSON;
}

const getDangerColor = (status: string) => {
  const s = status.toLowerCase();
  if (s.includes('respins') || s.includes('retras')) {
    return 'border-danger/50 shadow-danger/10';
  }
  if (s.includes('urgenta') || s.includes('urgentă')) {
    return 'border-warning/50 shadow-warning/10';
  }
  return 'border-white/5 hover:border-primary/30';
};

export const LawCard = ({ data }: LawCardProps) => {
  const { law, statusHistory } = data;

  return (
    <div className={cn(
      "glass-card p-6 transition-all duration-300 hover:shadow-2xl flex flex-col gap-6",
      getDangerColor(law.currentStatus)
    )}>
      <div className="flex flex-col gap-4">
        <div className="flex justify-between items-start gap-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 text-xs font-semibold rounded-md bg-primary/10 text-primary border border-primary/20">
                {law.registrationNumber}
              </span>
              <span className="flex items-center gap-1 text-xs font-medium text-textSecondary px-2 py-1 bg-surface rounded-md border border-white/5">
                <Building2 className="w-3.5 h-3.5" />
                {law.chamber}
              </span>
            </div>
            <h3 className="text-xl font-bold leading-tight text-textPrimary tracking-tight">
              {law.title}
            </h3>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <div className="flex items-center gap-1.5 text-textSecondary">
            <FileText className="w-4 h-4" />
            <span>Status curent:</span>
            <span className="font-semibold text-textPrimary">{law.currentStatus}</span>
          </div>
          
          {law.originalUrl && (
            <a 
              href={law.originalUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-primary hover:text-primary/80 transition-colors ml-auto"
            >
              <span>Sursă oficială</span>
              <ExternalLink className="w-4 h-4" />
            </a>
          )}
        </div>
      </div>

      <div className="pt-6 border-t border-white/10">
        <h4 className="text-sm font-semibold text-textSecondary mb-4 uppercase tracking-wider">Parcurs Legislativ</h4>
        <Timeline history={statusHistory} />
      </div>
    </div>
  );
};
