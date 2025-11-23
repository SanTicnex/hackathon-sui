'use client';

import { useCurrentAccount, useSuiClient } from "@mysten/dapp-kit";
import { useNetworkVariable } from "./networkConfig";
import { useEffect, useState } from "react";
import App from "./App";
import { KycDemoCard } from "./components/KycDemoCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Home() {
  const currentAccount = useCurrentAccount();
  const suiClient = useSuiClient();
  const counterPackageId = useNetworkVariable("counterPackageId");
  const [isVerified, setIsVerified] = useState(false);
  const [checking, setChecking] = useState(false);

  const checkVerifiedBuyerOnChain = async (address: string) => {
    try {
      const objects = await suiClient.getOwnedObjects({
        owner: address,
        filter: {
          StructType: `${counterPackageId}::euid_identity::VerifiedBuyer`,
        },
        options: {
          showType: true,
        },
      });
      return objects.data.length > 0;
    } catch (error) {
      console.error('Error checking VerifiedBuyer on-chain:', error);
      return false;
    }
  };

  useEffect(() => {
    if (currentAccount?.address) {
      setChecking(true);
      checkVerifiedBuyerOnChain(currentAccount.address).then((verified) => {
        setIsVerified(verified);
        setChecking(false);
      });
    } else {
      setIsVerified(false);
      setChecking(false);
    }
  }, [currentAccount?.address, suiClient, counterPackageId]);

  return (
    <div className="bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-slate-900 mb-4">
            Welcome to Counter App
          </h1>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            A beautiful and modern counter application built with Next.js, Tailwind CSS, and shadcn/ui components.
          </p>
        </div>

        <div className="flex justify-center">
          {currentAccount ? (
            isVerified ? (
              <App />
            ) : (
              <Card className="max-w-md mx-auto">
                <CardHeader>
                  <CardTitle className="text-center">Paso 0: Verificar Identidad</CardTitle>
                </CardHeader>
                <CardContent>
                  {checking ? (
                    <p className="text-center">Verificando identidad on-chain...</p>
                  ) : (
                    <>
                      <p className="text-center mb-4">
                        Debe verificar su identidad antes de proceder con la pre-reserva.
                      </p>
                      <KycDemoCard
                        suiAddress={currentAccount.address}
                        onVerified={async (verified) => {
                          if (verified) {
                            const onChainVerified = await checkVerifiedBuyerOnChain(currentAccount.address);
                            setIsVerified(onChainVerified);
                          } else {
                            setIsVerified(false);
                          }
                        }}
                      />
                    </>
                  )}
                </CardContent>
              </Card>
            )
          ) : (
            <Card className="max-w-md mx-auto">
              <CardContent className="pt-6">
                <p className="text-center">Conecte su wallet para comenzar.</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}