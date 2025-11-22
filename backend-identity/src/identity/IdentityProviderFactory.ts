import { IdentityProvider } from './IdentityProvider';
import { DummyIdentityProvider } from './DummyIdentityProvider';

export function createIdentityProvider(): IdentityProvider {
  const USE_REAL_WALLET = process.env.USE_REAL_WALLET === 'true';

  if (USE_REAL_WALLET) {
    // TODO: integrate OpenId4VpIdentityProvider when available
    // return new OpenId4VpIdentityProvider(...);
  }

  return new DummyIdentityProvider();
}
