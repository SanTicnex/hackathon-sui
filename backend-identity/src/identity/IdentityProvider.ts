export interface IdentityProvider {
  startKycSession(params: { suiAddress: string }): Promise<{
    sessionId: string;
    authorizationRequestUrl: string;
  }>;

  completeKycSession(params: { sessionId: string }): Promise<{
    vpToken: string;
  }>;
}
