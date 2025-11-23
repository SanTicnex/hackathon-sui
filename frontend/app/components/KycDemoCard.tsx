'use client';

import { useEffect, useMemo, useState } from 'react';
import { startKyc, completeKyc, getKycStatus } from '@/lib/identityClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

type KycStatus =
  | {
      verified: true;
      verifiedObjectId: string;
      issuedAt?: number;
      expiresAt?: number;
    }
  | {
      verified: false;
    };

type FlowStep = 'idle' | 'pending-wallet' | 'verifying';

interface Props {
  suiAddress: string;
  onVerified?: (verified: boolean) => void;
}

export function KycDemoCard({ suiAddress, onVerified }: Props) {
  const [status, setStatus] = useState<KycStatus>({ verified: false });
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [authorizationUrl, setAuthorizationUrl] = useState<string | null>(null);
  const [flowStep, setFlowStep] = useState<FlowStep>('idle');
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [resultMessage, setResultMessage] = useState<string | null>(null);

  const statusLabel = useMemo(() => {
    if (status.verified) return 'User verified';
    return 'User not verified';
  }, [status]);

  const loadStatus = async () => {
    if (!suiAddress) return;
    setLoadingStatus(true);
    try {
      const response = await getKycStatus(suiAddress);
      if (response.verified) {
        setStatus({
          verified: true,
          verifiedObjectId: response.verifiedObjectId,
          issuedAt: response.issuedAt,
          expiresAt: response.expiresAt,
        });
        onVerified?.(true);
      } else {
        setStatus({ verified: false });
        onVerified?.(false);
      }
    } catch (error) {
      console.error('[kyc] failed to load status', error);
      setResultMessage('Could not fetch verification status');
      onVerified?.(false);
    } finally {
      setLoadingStatus(false);
    }
  };

  useEffect(() => {
    setSessionId(null);
    setAuthorizationUrl(null);
    setFlowStep('idle');
    setResultMessage(null);
    loadStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suiAddress]);

  const handleStartKyc = async () => {
    setSubmitting(true);
    setResultMessage(null);
    try {
      const { sessionId, authorizationRequestUrl } = await startKyc(suiAddress);
      setSessionId(sessionId);
      setAuthorizationUrl(authorizationRequestUrl);
      setFlowStep('pending-wallet');
    } catch (error) {
      console.error('[kyc] start failed', error);
      setResultMessage('Could not start verification');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSimulateWallet = async () => {
    if (!sessionId) return;
    setSubmitting(true);
    setResultMessage(null);
    setFlowStep('verifying');
    try {
      const response = await completeKyc(sessionId, suiAddress);
      setResultMessage(
        `Verified: digest ${response.txDigest} - object ${response.verifiedObjectId}`
      );
      await loadStatus();
      setFlowStep('idle');
    } catch (error) {
      console.error('[kyc] complete failed', error);
      setResultMessage('Could not complete verification');
      setFlowStep('idle');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="border border-slate-200 shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg">
          EUDI identity verification (demo)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm text-slate-700">
        <p>
          In production, this would open your real EUDI Wallet and send a
          Verifiable Presentation via OpenID4VP. This demo uses a simulated
          flow but keeps the same data model.
        </p>

        <div className="flex items-center space-x-2">
          <span className="font-medium text-slate-900">Estado:</span>
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              status.verified
                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                : 'bg-slate-100 text-slate-700 border border-slate-200'
            }`}
          >
            {statusLabel}
          </span>
          {loadingStatus && (
            <span className="text-xs text-slate-500">Updating...</span>
          )}
        </div>

        {status.verified && status.verifiedObjectId && (
          <div className="text-xs text-slate-500">
            VerifiedBuyer: {status.verifiedObjectId}
          </div>
        )}

        <div className="space-y-2">
          <Button
            onClick={handleStartKyc}
            disabled={!suiAddress || submitting}
            className="w-full sm:w-auto"
          >
            Connect EUDI Wallet (simulated)
          </Button>
          {authorizationUrl && (
            <div className="rounded-md border border-dashed border-slate-300 p-3 text-xs bg-slate-50">
              <div className="font-semibold text-slate-900 mb-1">
                Authorization URL (demo)
              </div>
              <div className="break-all text-slate-700">{authorizationUrl}</div>
              <div className="text-slate-500 mt-1">
                Simulate a wallet scan and then click "Simulate wallet approval".
              </div>
              <Button
                onClick={handleSimulateWallet}
                disabled={submitting || flowStep === 'verifying'}
                className="mt-2"
              >
                {flowStep === 'verifying'
                  ? 'Verifying...'
                  : 'Simulate wallet approval'}
              </Button>
            </div>
          )}
        </div>

        {resultMessage && (
          <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md p-3">
            {resultMessage}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
