import { VoteJSON } from '../types';
import { format, parseISO } from 'date-fns';
import { ThumbsUp, ThumbsDown, Minus, HelpCircle, User } from 'lucide-react';
import { cn } from '../lib/utils';

interface MPProfileProps {
  votes: VoteJSON[];
}

const getVoteIcon = (value: string) => {
  switch (value) {
    case 'Yes': return <ThumbsUp className="w-4 h-4 text-success" />;
    case 'No': return <ThumbsDown className="w-4 h-4 text-danger" />;
    case 'Abstain': return <Minus className="w-4 h-4 text-warning" />;
    case 'Absent': return <HelpCircle className="w-4 h-4 text-textSecondary" />;
    default: return <Minus className="w-4 h-4" />;
  }
};

const getVoteColor = (value: string) => {
  switch (value) {
    case 'Yes': return 'text-success bg-success/10 border-success/20';
    case 'No': return 'text-danger bg-danger/10 border-danger/20';
    case 'Abstain': return 'text-warning bg-warning/10 border-warning/20';
    case 'Absent': return 'text-textSecondary bg-surface border-white/10';
    default: return 'text-textSecondary bg-surface border-white/10';
  }
};

const translateVote = (value: string) => {
  switch (value) {
    case 'Yes': return 'Pentru';
    case 'No': return 'Contra';
    case 'Abstain': return 'Abținere';
    case 'Absent': return 'Absent';
    default: return value;
  }
};

export const MPProfile = ({ votes }: MPProfileProps) => {
  if (!votes || votes.length === 0) return null;

  const member = votes[0].member;

  return (
    <div className="glass-card p-6 flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-surface border border-white/10 flex items-center justify-center overflow-hidden shrink-0">
          {member.photoUrl ? (
            <img src={member.photoUrl} alt={member.name} className="w-full h-full object-cover" />
          ) : (
            <User className="w-8 h-8 text-textSecondary" />
          )}
        </div>
        <div>
          <h2 className="text-xl font-bold text-textPrimary">{member.name}</h2>
          <div className="flex items-center gap-2 mt-1">
            <span className="px-2 py-0.5 text-xs font-medium bg-primary/20 text-primary rounded">
              {member.chamber}
            </span>
            {member.party && (
              <span className="px-2 py-0.5 text-xs font-medium bg-surface text-textSecondary rounded border border-white/5">
                {member.party}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="border-t border-white/10 pt-6">
        <h3 className="text-sm font-semibold text-textSecondary mb-4 uppercase tracking-wider">
          Istoric Voturi Recente
        </h3>
        
        <div className="space-y-3">
          {votes.map((vote, idx) => (
            <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg bg-surface/50 border border-white/5 hover:border-white/10 transition-colors">
              <div className="flex flex-col gap-1">
                <span className="font-medium text-sm text-textPrimary">{vote.lawRegistrationNumber}</span>
                <time dateTime={vote.voteDate} className="text-xs text-textSecondary">
                  {format(parseISO(vote.voteDate), 'dd MMM yyyy')}
                </time>
              </div>
              
              <div className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-md border text-sm font-medium w-fit",
                getVoteColor(vote.voteValue)
              )}>
                {getVoteIcon(vote.voteValue)}
                {translateVote(vote.voteValue)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
