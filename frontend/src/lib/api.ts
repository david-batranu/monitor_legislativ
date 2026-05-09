import { LegislativeJSON, VoteJSON } from '../types';

const API_BASE = 'http://localhost:8787/api';

// Fallback mock data in case API is down
const mockLaws: LegislativeJSON[] = [
  {
    law: {
      title: 'Proiect de lege privind aprobarea Ordonanţei de urgenţă a Guvernului nr. 21/2024',
      registrationNumber: 'L123/2024',
      currentStatus: 'În promulgare',
      chamber: 'CDEP',
      originalUrl: 'https://cdep.ro/pls/proiecte/upl_pck2015.proiect?cam=2&idp=21634'
    },
    statusHistory: [
      { statusLabel: 'Adoptat', timestamp: '2024-04-20T10:00:00Z', location: 'Camera Deputaților' },
      { statusLabel: 'Aviz favorabil', timestamp: '2024-04-15T10:00:00Z', location: 'Comisia Juridică' },
      { statusLabel: 'Înregistrat', timestamp: '2024-04-01T10:00:00Z', location: 'Senat' }
    ]
  },
  {
    law: {
      title: 'Propunere legislativă pentru modificarea Codului Fiscal',
      registrationNumber: 'L456/2024',
      currentStatus: 'Respins definitiv',
      chamber: 'Senat',
    },
    statusHistory: [
      { statusLabel: 'Respins', timestamp: '2024-05-01T10:00:00Z', location: 'Senat' },
      { statusLabel: 'Aviz negativ', timestamp: '2024-04-25T10:00:00Z', location: 'Comisia de Buget' }
    ]
  }
];

const mockVotes: VoteJSON[] = [
  {
    lawRegistrationNumber: 'L123/2024',
    member: { name: 'Popescu Ion', chamber: 'CDEP', party: 'Independent' },
    voteValue: 'Yes',
    voteDate: '2024-04-20T10:00:00Z'
  },
  {
    lawRegistrationNumber: 'L456/2024',
    member: { name: 'Popescu Ion', chamber: 'CDEP', party: 'Independent' },
    voteValue: 'Abstain',
    voteDate: '2024-05-01T10:00:00Z'
  }
];

export const fetchLaws = async (): Promise<LegislativeJSON[]> => {
  try {
    const res = await fetch(`${API_BASE}/laws`);
    if (!res.ok) throw new Error('Network error');
    const json = await res.json();
    return json.data;
  } catch (e) {
    console.warn('Using mock data for laws', e);
    return mockLaws;
  }
};

export const fetchMemberVotes = async (memberId: string): Promise<VoteJSON[]> => {
  try {
    const res = await fetch(`${API_BASE}/members/${memberId}/votes`);
    if (!res.ok) throw new Error('Network error');
    const json = await res.json();
    return json.data;
  } catch (e) {
    console.warn('Using mock data for votes', e);
    return mockVotes;
  }
};
