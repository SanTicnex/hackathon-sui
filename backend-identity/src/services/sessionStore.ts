import { v4 as uuid } from 'uuid';

type Session = {
  suiAddress: string;
  propertyId?: string;
};

const sessions = new Map<string, Session>();

export function createSession(suiAddress: string, propertyId?: string) {
  const sessionId = uuid();
  sessions.set(sessionId, { suiAddress, propertyId });
  return { sessionId };
}

export function getSession(sessionId: string): Session | null {
  return sessions.get(sessionId) ?? null;
}
