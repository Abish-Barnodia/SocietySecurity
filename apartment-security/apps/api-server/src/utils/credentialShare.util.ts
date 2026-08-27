import { prisma } from '../config/prisma';

export const MAX_CREDENTIAL_SHARES = 2;

// Atomic increment-if-under-limit — a single UPDATE ... WHERE count < N, so
// two concurrent share attempts can't both slip past the cap the way a
// separate read-then-write would.
export const tryConsumeCredentialShare = async (userId: string): Promise<boolean> => {
  const result = await prisma.user.updateMany({
    where: { id: userId, credentialShareCount: { lt: MAX_CREDENTIAL_SHARES } },
    data: { credentialShareCount: { increment: 1 } },
  });
  return result.count > 0;
};
