type StartKycResponse = {
  sessionId: string;
  authorizationRequestUrl: string;
  qrCodeData: string;
};

type CompleteKycResponse = {
  status: string;
  suiAddress: string;
  txDigest: string;
  verifiedObjectId: string;
  issuedAt: number;
  expiresAt: number;
};

type StatusResponse =
  | {
      suiAddress: string;
      verified: true;
      verifiedObjectId: string;
      issuedAt?: number;
      expiresAt?: number;
    }
  | {
      suiAddress: string;
      verified: false;
    };

const baseUrl =
  process.env.NEXT_PUBLIC_IDENTITY_BACKEND_URL ??
  'http://localhost:4000';

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || 'Request failed');
  }
  return res.json() as Promise<T>;
}

export async function startKyc(
  suiAddress: string,
  propertyId?: string
): Promise<StartKycResponse> {
  const res = await fetch(`${baseUrl}/kyc/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ suiAddress, propertyId }),
  });

  return handleResponse<StartKycResponse>(res);
}

export async function completeKyc(
  sessionId: string,
  suiAddress: string
): Promise<CompleteKycResponse> {
  const res = await fetch(`${baseUrl}/kyc/callback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, suiAddress }),
  });

  return handleResponse<CompleteKycResponse>(res);
}

export async function getKycStatus(
  suiAddress: string
): Promise<StatusResponse> {
  const res = await fetch(`${baseUrl}/kyc/status/${suiAddress}`);
  return handleResponse<StatusResponse>(res);
}
