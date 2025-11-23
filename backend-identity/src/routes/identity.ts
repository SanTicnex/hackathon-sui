import { Router } from 'express';
import { createHash } from 'crypto';
import { z } from 'zod';
import { getSession } from '../services/sessionStore';
import {
  createVerifiedBuyerOnChain,
  findVerifiedBuyerForAddress,
} from '../services/suiClient';
import { IdentityProvider } from '../identity/IdentityProvider';
import { createIdentityProvider } from '../identity/IdentityProviderFactory';

const router = Router();
const identityProvider: IdentityProvider = createIdentityProvider();

const startSchema = z.object({
  suiAddress: z.string().min(3),
  propertyId: z.string().optional(),
});

router.post('/start', async (req, res) => {
  const parsed = startSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload' });
  }

  const { suiAddress } = parsed.data;

  try {
    const { sessionId, authorizationRequestUrl } =
      await identityProvider.startKycSession({ suiAddress });

    return res.json({
      sessionId,
      authorizationRequestUrl,
      qrCodeData: 'SIMULATED_QR_DATA',
    });
  } catch (error) {
    console.error('[start] failed', error);
    return res.status(500).json({ error: 'Failed to start KYC session' });
  }
});

const callbackSchema = z.object({
  sessionId: z.string(),
  suiAddress: z.string(),
});

router.post('/callback', async (req, res) => {
  const parsed = callbackSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ status: 'rejected', error: 'Invalid payload' });
  }

  const { sessionId, suiAddress } = parsed.data;
  const session = getSession(sessionId);

  if (!session) {
    return res.status(404).json({ status: 'rejected', error: 'Session not found' });
  }

  if (session.suiAddress !== suiAddress) {
    return res.status(400).json({ status: 'rejected', error: 'Session address mismatch' });
  }

  try {
    const { vpToken } = await identityProvider.completeKycSession({ sessionId });

    const vpHash = createHash('sha256').update(vpToken).digest('hex');
    const expiresAt =
      Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days of simulated validity

    const result = await createVerifiedBuyerOnChain({
      recipient: suiAddress,
      vpHash,
      expiresAt,
    });

    return res.json({
      status: 'verified',
      suiAddress,
      txDigest: result.txDigest,
      verifiedObjectId: result.verifiedObjectId,
      issuedAt: result.issuedAt,
      expiresAt: result.expiresAt,
    });
  } catch (error) {
    console.error('[callback] failed', error);
    return res.status(500).json({ status: 'rejected', error: 'Failed to mint on-chain' });
  }
});

router.get('/status/:suiAddress', async (req, res) => {
  const suiAddress = req.params.suiAddress;

  try {
    const verified = await findVerifiedBuyerForAddress(suiAddress);

    if (!verified) {
      return res.json({ suiAddress, verified: false });
    }

    return res.json({
      suiAddress,
      verified: true,
      verifiedObjectId: verified.verifiedObjectId,
      issuedAt: verified.issuedAt,
      expiresAt: verified.expiresAt,
    });
  } catch (error) {
    console.error('[status] failed', error);
    return res.status(500).json({ error: 'Failed to query status' });
  }
});

export default router;
