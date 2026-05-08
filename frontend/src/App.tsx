import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchLaws, fetchMemberVotes } from './lib/api';
import { LawCard } from './components/LawCard';
import { MPProfile } from './components/MPProfile';
import { Search, Filter, AlertCircle, Loader2, Scale } from 'lucide-react';

function App() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [activeTab, setActiveTab] = useState<'laws' | 'mp'>('laws');

  const { data: laws, isLoading: isLoadingLaws, error: lawsError } = useQuery({
    queryKey: ['laws'],
    queryFn: fetchLaws,
  });

  const { data: mpVotes, isLoading: isLoadingMp } = useQuery({
    queryKey: ['mpVotes', 'popescu-ion'],
    queryFn: () => fetchMemberVotes('popescu-ion'),
    enabled: activeTab === 'mp',
  });

  const filteredLaws = useMemo(() => {
    if (!laws) return [];
    return laws.filter((item) => {
      const matchesSearch = item.law.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            item.law.registrationNumber.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter ? item.law.currentStatus.toLowerCase().includes(statusFilter.toLowerCase()) : true;
      return matchesSearch && matchesStatus;
    });
  }, [laws, searchQuery, statusFilter]);

  const uniqueStatuses = useMemo(() => {
    if (!laws) return [];
    const statuses = new Set(laws.map(l => l.law.currentStatus));
    return Array.from(statuses);
  }, [laws]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 glass border-b border-white/10 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center border border-primary/30">
              <Scale className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-white to-textSecondary bg-clip-text text-transparent">
                Monitor Legislativ
              </h1>
              <p className="text-xs text-textSecondary font-medium">Transparență pentru România</p>
            </div>
          </div>

          <nav className="flex items-center gap-2 bg-surface/50 p-1 rounded-lg border border-white/5">
            <button
              onClick={() => setActiveTab('laws')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                activeTab === 'laws' ? 'bg-primary text-white shadow-lg shadow-primary/25' : 'text-textSecondary hover:text-white hover:bg-white/5'
              }`}
            >
              Proiecte de Lege
            </button>
            <button
              onClick={() => setActiveTab('mp')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                activeTab === 'mp' ? 'bg-primary text-white shadow-lg shadow-primary/25' : 'text-textSecondary hover:text-white hover:bg-white/5'
              }`}
            >
              Profil Parlamentar
            </button>
          </nav>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {activeTab === 'laws' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-textSecondary" />
                <input
                  type="text"
                  placeholder="Caută după titlu sau număr (ex: L123/2024)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-surface border border-white/10 rounded-xl text-textPrimary placeholder:text-textSecondary/50 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all shadow-inner"
                />
              </div>
              <div className="relative md:w-64">
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-textSecondary" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-surface border border-white/10 rounded-xl text-textPrimary appearance-none focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all shadow-inner"
                >
                  <option value="">Toate statusurile</option>
                  {uniqueStatuses.map(status => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Content */}
            {isLoadingLaws ? (
              <div className="flex flex-col items-center justify-center py-20 text-textSecondary gap-4">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p>Se încarcă datele legislative...</p>
              </div>
            ) : lawsError ? (
              <div className="glass-card p-6 flex items-center gap-4 border-danger/50 bg-danger/5 text-danger">
                <AlertCircle className="w-6 h-6 shrink-0" />
                <p>Eroare la încărcarea datelor. Vă rugăm să reîncercați mai târziu.</p>
              </div>
            ) : filteredLaws.length === 0 ? (
              <div className="text-center py-20 text-textSecondary glass-card">
                <p className="text-lg">Nu am găsit proiecte de lege care să corespundă criteriilor.</p>
              </div>
            ) : (
              <div className="grid gap-6 md:grid-cols-2">
                {filteredLaws.map((lawData, idx) => (
                  <LawCard key={idx} data={lawData} />
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'mp' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-2xl mx-auto">
            {isLoadingMp ? (
              <div className="flex items-center justify-center py-20 text-textSecondary">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : mpVotes ? (
              <MPProfile votes={mpVotes} />
            ) : (
              <p className="text-center text-textSecondary">Nu s-au putut încărca datele parlamentarului.</p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
