import { IdentityProvider } from './IdentityProvider';
import { createSession, getSession } from '../services/sessionStore';

const DUMMY_VP_TOKEN = 'dummy_vp_token_for_demo';

export class DummyIdentityProvider implements IdentityProvider {
  async startKycSession(params: { suiAddress: string }) {
    const { suiAddress } = params;
    const { sessionId } = createSession(suiAddress);

    return {
      sessionId,
      authorizationRequestUrl: `https://demo-eudi-wallet.local/authorize?sessionId=${sessionId}`,
    };
  }

  async completeKycSession(params: { sessionId: string }) {
    const { sessionId } = params;
    const session = getSession(sessionId);

    if (!session) {
      throw new Error('Session not found');
    }

    return {
      vpToken: DUMMY_VP_TOKEN,
    };
  }
}
