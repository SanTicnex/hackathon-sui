"use client";

type StartParams = {
  walletAddress: string;
  propertyId?: string;
};

type KycStatusResponse = {
  status: "pending" | "verified" | "rejected";
  vpHash?: string;
  verifiedObjectId?: string;
  issuedAt?: number;
  expiresAt?: number;
};

const DEFAULT_BASE_URL = "http://localhost:4000";

const rawBaseUrl =
  process.env.NEXT_PUBLIC_IDENTITY_API_URL?.trim() || DEFAULT_BASE_URL;
const normalizedBaseUrl = rawBaseUrl.replace(/\/$/, "");
const kycBaseUrl = normalizedBaseUrl.endsWith("/kyc")
  ? normalizedBaseUrl
  : `${normalizedBaseUrl}/kyc`;

const sessionWalletMap = new Map<string, string>();

function getPropertyIdPayload(propertyId?: string) {
  if (!propertyId) {
    return {};
  }
  return { propertyId };
}

async function handleResponse(response: Response) {
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    const error = body || `Request failed with status ${response.status}`;
    throw new Error(error);
  }
  return response.json();
}

export async function startKycSession({
  walletAddress,
  propertyId,
}: StartParams): Promise<{ sessionId: string }> {
  try {
    const response = await fetch(`${kycBaseUrl}/start`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        suiAddress: walletAddress,
        ...getPropertyIdPayload(propertyId),
      }),
    });

    const payload = await handleResponse(response);

    if (!payload.sessionId) {
      throw new Error("La respuesta del backend no incluye sessionId.");
    }

    sessionWalletMap.set(payload.sessionId, walletAddress);

    return {
      sessionId: payload.sessionId,
    };
  } catch (error) {
    console.error("[identityClient] startKycSession failed", error);
    throw error instanceof Error
      ? error
      : new Error("No se pudo iniciar la verificación de identidad.");
  }
}

export async function checkKycStatus(
  sessionId: string,
): Promise<KycStatusResponse> {
  const walletAddress = sessionWalletMap.get(sessionId);

  if (!walletAddress) {
    throw new Error("No se encontró la wallet asociada a esta sesión.");
  }

  try {
    const response = await fetch(
      `${kycBaseUrl}/status/${encodeURIComponent(walletAddress)}`,
    );
    const payload = await handleResponse(response);

    if (payload?.verified) {
      return {
        status: "verified",
        verifiedObjectId: payload.verifiedObjectId,
        issuedAt: payload.issuedAt,
        expiresAt: payload.expiresAt,
      };
    }

    return { status: "pending" };
  } catch (error) {
    console.error("[identityClient] checkKycStatus failed", error);
    throw error instanceof Error
      ? error
      : new Error("No se pudo consultar el estado de la verificación.");
  }
}
