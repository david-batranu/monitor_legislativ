export type Chamber = 'Senat' | 'CDEP';
export type VoteValue = 'Yes' | 'No' | 'Abstain' | 'Absent';

export interface StatusHistoryEntry {
  statusLabel: string;
  location?: string | null;
  timestamp: string; // ISO 8601 date-time string
}

export interface LawData {
  title: string;
  registrationNumber: string; // e.g. L123/2024
  currentStatus: string;
  chamber: Chamber;
  originalUrl?: string | null;
}

export interface LegislativeJSON {
  law: LawData;
  statusHistory?: StatusHistoryEntry[];
}

export interface MemberData {
  name: string;
  party?: string | null;
  chamber: Chamber;
  photoUrl?: string | null;
}

export interface VoteJSON {
  lawRegistrationNumber: string;
  member: MemberData;
  voteValue: VoteValue;
  voteDate: string; // ISO 8601 date-time string
}
