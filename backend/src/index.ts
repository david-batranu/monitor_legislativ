import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { eq, desc, and } from 'drizzle-orm';
import { getDb } from './db';
import { laws, statusHistory, members, votes } from './db/schema';
import { LegislativeJSON, VoteJSON } from './types';

export type Bindings = {
  DATABASE_URL: string;
};

const app = new Hono<{ Bindings: Bindings }>();

app.use('/api/*', cors());

// Health check
app.get('/api', (c) => c.text('Monitor Legislativ API'));

// GET /api/laws - List laws with filters (status, chamber)
app.get('/api/laws', async (c) => {
  const db = getDb(c.env.DATABASE_URL);
  const { status, chamber } = c.req.query();
  
  const results = await db.query.laws.findMany({
    where: (laws, { eq, and }) => {
      const filters = [];
      if (status) filters.push(eq(laws.currentStatus, status));
      if (chamber) filters.push(eq(laws.chamber, chamber));
      return filters.length > 0 ? and(...filters) : undefined;
    },
    with: {
      statusHistory: true,
    },
    orderBy: [desc(laws.id)],
  });

  // Map to LegislativeJSON format
  const data = results.map(l => ({
    law: {
      title: l.title,
      registrationNumber: l.registrationNumber,
      currentStatus: l.currentStatus,
      chamber: l.chamber as any,
      originalUrl: l.originalUrl,
    },
    statusHistory: l.statusHistory.map(h => ({
      statusLabel: h.statusLabel,
      location: h.location,
      timestamp: h.timestamp.toISOString(),
    })),
  }));

  return c.json({ data });
});

// GET /api/laws/:id - Detailed view including status timeline and vote breakdown
app.get('/api/laws/:id', async (c) => {
  const db = getDb(c.env.DATABASE_URL);
  const { id } = c.req.param();

  // Basic UUID validation
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) {
    return c.json({ error: 'Invalid ID format' }, 400);
  }

  const law = await db.query.laws.findFirst({
    where: (laws, { eq }) => eq(laws.id, id),
    with: {
      statusHistory: {
        orderBy: (history, { asc }) => [asc(history.timestamp)],
      },
      votes: {
        with: {
          member: true,
        },
      },
    },
  });

  if (!law) {
    return c.json({ error: 'Law not found' }, 404);
  }

  // Calculate vote breakdown
  const voteBreakdown = {
    Yes: 0,
    No: 0,
    Abstain: 0,
    Absent: 0,
  };

  law.votes.forEach((v) => {
    if (v.voteValue in voteBreakdown) {
      voteBreakdown[v.voteValue as keyof typeof voteBreakdown]++;
    }
  });

  return c.json({ data: { ...law, voteBreakdown } });
});

// GET /api/members/:id/votes - Voting history for a specific member
app.get('/api/members/:id/votes', async (c) => {
  const db = getDb(c.env.DATABASE_URL);
  const { id } = c.req.param();

  const results = await db.query.votes.findMany({
    where: (votes, { eq }) => eq(votes.memberId, id),
    with: {
      law: true,
      member: true,
    },
    orderBy: [desc(votes.voteDate)],
  });

  const data = results.map(v => ({
    lawRegistrationNumber: v.law.registrationNumber,
    member: {
      name: v.member.name,
      party: v.member.party,
      chamber: v.member.chamber as any,
      photoUrl: v.member.photoUrl,
    },
    voteValue: v.voteValue as any,
    voteDate: v.voteDate.toISOString(),
  }));

  return c.json({ data });
});

// POST /api/sync/law - Upsert a law and its status history
app.post('/api/sync/law', async (c) => {
  const db = getDb(c.env.DATABASE_URL);
  const payload = await c.req.json<LegislativeJSON>();

  const { law: lawData, statusHistory: historyData } = payload;

  if (!lawData || !lawData.registrationNumber) {
    return c.json({ error: 'Invalid payload' }, 400);
  }

  // Upsert the law
  const [upsertedLaw] = await db.insert(laws).values({
    title: lawData.title,
    registrationNumber: lawData.registrationNumber,
    currentStatus: lawData.currentStatus,
    chamber: lawData.chamber,
    originalUrl: lawData.originalUrl,
  })
  .onConflictDoUpdate({
    target: laws.registrationNumber,
    set: {
      title: lawData.title,
      currentStatus: lawData.currentStatus,
      chamber: lawData.chamber,
      originalUrl: lawData.originalUrl,
    },
  })
  .returning();

  // Sync status history
  if (historyData && historyData.length > 0) {
    // Overwrite the history to keep it synced
    await db.delete(statusHistory).where(eq(statusHistory.lawId, upsertedLaw.id));
    
    await db.insert(statusHistory).values(
      historyData.map(h => ({
        lawId: upsertedLaw.id,
        statusLabel: h.statusLabel,
        location: h.location || null,
        timestamp: new Date(h.timestamp),
      }))
    );
  }

  return c.json({ message: 'Law synced', lawId: upsertedLaw.id });
});

// POST /api/sync/vote - Record individual member votes
app.post('/api/sync/vote', async (c) => {
  const db = getDb(c.env.DATABASE_URL);
  const payload = await c.req.json<VoteJSON>();

  const { lawRegistrationNumber, member: memberData, voteValue, voteDate } = payload;

  if (!lawRegistrationNumber || !memberData || !voteValue) {
    return c.json({ error: 'Invalid payload' }, 400);
  }

  // Find the law
  const law = await db.query.laws.findFirst({
    where: (laws, { eq }) => eq(laws.registrationNumber, lawRegistrationNumber),
  });

  if (!law) {
    return c.json({ error: 'Law not found' }, 404);
  }

  // Upsert the member (assuming name + chamber is a unique identifier here)
  let member = await db.query.members.findFirst({
    where: (members, { eq, and }) => 
      and(
        eq(members.name, memberData.name),
        eq(members.chamber, memberData.chamber)
      ),
  });

  if (!member) {
    const [newMember] = await db.insert(members).values({
      name: memberData.name,
      party: memberData.party || null,
      chamber: memberData.chamber,
      photoUrl: memberData.photoUrl || null,
    }).returning();
    member = newMember;
  } else {
    // Update member info if it has changed
    const [updatedMember] = await db.update(members)
      .set({
        party: memberData.party || member.party,
        photoUrl: memberData.photoUrl || member.photoUrl,
      })
      .where(eq(members.id, member.id))
      .returning();
    member = updatedMember;
  }

  // Insert or update the vote
  // We'll delete any existing vote by this member on this law to ensure it's recorded correctly
  await db.delete(votes).where(
    and(
      eq(votes.lawId, law.id),
      eq(votes.memberId, member.id)
    )
  );

  await db.insert(votes).values({
    lawId: law.id,
    memberId: member.id,
    voteValue: voteValue,
    voteDate: new Date(voteDate),
  });

  return c.json({ message: 'Vote synced' });
});

export default app;
