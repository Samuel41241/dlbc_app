import jwt from 'jsonwebtoken';
import { NextRequest } from 'next/server';
import type { SystemRole } from '@/lib/rbac';

export type AuthUser = {
  userId: string;
  email: string;
  role: SystemRole; // ✅ FIXED
  stateId?: string | null;
  regionId?: string | null;
  groupId?: string | null;
  districtId?: string | null;
  locationId?: string | null;
};

export function signToken(payload: Omit<AuthUser, 'userId'> & { userId: string }): string {
  return jwt.sign(payload, process.env.INTERNAL_SECRET!, { expiresIn: '7d' });
}

export function verifyToken(token: string): AuthUser | null {
  try {
    return jwt.verify(token, process.env.INTERNAL_SECRET!) as AuthUser;
  } catch {
    return null;
  }
}

export function getUserFromRequest(request: NextRequest): AuthUser | null {
  const authHeader = request.headers.get('authorization');

  if (!authHeader) return null;

  const token = authHeader.split(' ')[1];
  if (!token) return null;

  return verifyToken(token);
}