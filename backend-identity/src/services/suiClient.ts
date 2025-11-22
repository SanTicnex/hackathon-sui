import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { decodeSuiPrivateKey } from '@mysten/sui/cryptography';
import { fromB64, fromHex } from '@mysten/sui/utils';
import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';

type Network = 'testnet' | 'devnet' | 'localnet' | 'mainnet';

const network = (process.env.SUI_NETWORK ?? 'testnet') as Network;
export const client = new SuiClient({ url: getFullnodeUrl(network) });

const packageId = process.env.EUID_PACKAGE_ID;
const authorityAddress = process.env.AUTHORITY_ADDRESS;
const mnemonic = process.env.BACKEND_MNEMONIC;
const privateKey = process.env.BACKEND_PRIVATE_KEY;

function getKeypair(): Ed25519Keypair {
  if (mnemonic) {
    return Ed25519Keypair.deriveKeypair(mnemonic);
  }

  if (privateKey) {
    if (privateKey.startsWith('suiprivkey')) {
      const decoded = decodeSuiPrivateKey(privateKey);
      return Ed25519Keypair.fromSecretKey(decoded.secretKey);
    }

    const keyBytes = privateKey.startsWith('0x')
      ? fromHex(privateKey)
      : fromB64(privateKey);
    return Ed25519Keypair.fromSecretKey(keyBytes);
  }

  throw new Error('BACKEND_MNEMONIC or BACKEND_PRIVATE_KEY is required');
}

const authorityKeypair = getKeypair();
const authority = authorityAddress ?? authorityKeypair.toSuiAddress();

type CreateArgs = {
  recipient: string;
  vpHash: string;
  expiresAt: number;
};

export async function createVerifiedBuyerOnChain({
  recipient,
  vpHash,
  expiresAt,
}: CreateArgs) {
  if (!packageId) {
    throw new Error('EUID_PACKAGE_ID is required');
  }

  const tx = new Transaction();
  tx.setSender(authority);

  tx.moveCall({
    target: `${packageId}::euid_identity::create_verified_buyer`,
    arguments: [
      tx.pure.address(recipient),
      tx.pure.vector('u8', Array.from(Buffer.from(vpHash, 'hex'))),
      tx.pure.u64(expiresAt),
    ],
  });

  const response = await client.signAndExecuteTransaction({
    signer: authorityKeypair,
    transaction: tx,
    options: {
      showEffects: true,
      showEvents: true,
    },
  });

  const eventType = `${packageId}::euid_identity::VerifiedBuyerCreated`;
  const evt = response.events?.find((e: any) => e.type === eventType);
  const verifiedObjectIdFromEvent =
    (evt?.parsedJson as { verified_object_id?: string } | null)
      ?.verified_object_id ?? null;

  const created = response.effects?.created ?? [];
  const verifiedObjectId =
    verifiedObjectIdFromEvent ??
    created.find((obj: any) => obj.owner && 'AddressOwner' in obj.owner)
      ?.reference?.objectId ??
    null;
  const issuedAt =
    (evt?.parsedJson as { issued_at?: number } | null)?.issued_at ??
    Date.now();
  const expiresAtFromEvent =
    (evt?.parsedJson as { expires_at?: number } | null)?.expires_at ??
    expiresAt;

  return {
    txDigest: response.digest,
    verifiedObjectId,
    issuedAt,
    expiresAt: expiresAtFromEvent,
  };
}

export async function findVerifiedBuyerForAddress(suiAddress: string) {
  if (!packageId) {
    throw new Error('EUID_PACKAGE_ID is required');
  }

  const type = `${packageId}::euid_identity::VerifiedBuyer`;
  const objects = await client.getOwnedObjects({
    owner: suiAddress,
    filter: { StructType: type },
    options: {
      showType: true,
      showContent: true,
    },
  });

  const first = objects.data[0];
  if (!first || first.data?.objectId === undefined) {
    return null;
  }

  const content = first.data.content as
    | { fields: { issued_at?: string | number; expires_at?: string | number } }
    | undefined;

  const issuedAtRaw = content?.fields?.issued_at;
  const expiresAtRaw = content?.fields?.expires_at;

  return {
    verifiedObjectId: first.data.objectId,
    issuedAt:
      issuedAtRaw !== undefined ? Number(issuedAtRaw) : undefined,
    expiresAt:
      expiresAtRaw !== undefined ? Number(expiresAtRaw) : undefined,
  };
}
