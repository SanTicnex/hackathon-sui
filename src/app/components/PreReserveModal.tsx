"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useCurrentAccount } from "@mysten/dapp-kit";
import { Button } from "@/components/ui/button";
import { KycStepWizard } from "./KycStepWizard";
import { CheckCircle2, Loader2, MapPin, Wallet } from "lucide-react";
import {
  checkKycStatus,
  startKycSession,
} from "@/services/identityClient";

type SelectedProperty = {
  id: { id: string } | string;
  name?: string;
  title?: string;
  physical_address?: string;
  location?: string;
  price?: string | number;
  priceLabel?: string;
};

interface PreReserveModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedProperty?: SelectedProperty;
}

const STEPS = [
  { id: 0, label: "Verificar identidad" },
  { id: 1, label: "Confirmar pre-reserva" },
  { id: 2, label: "Completado" },
];

export function PreReserveModal({
  isOpen,
  onClose,
  selectedProperty,
}: PreReserveModalProps) {
  const account = useCurrentAccount();
  const [step, setStep] = useState(0);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [kycSessionId, setKycSessionId] = useState<string | null>(null);
  const [kycError, setKycError] = useState<string | null>(null);
  const confirmationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fallbackVerificationTimer =
    useRef<ReturnType<typeof setTimeout> | null>(null);

  const propertyTitle = useMemo(
    () => selectedProperty?.name || selectedProperty?.title || "Propiedad",
    [selectedProperty?.name, selectedProperty?.title],
  );

  const propertyLocation = useMemo(
    () =>
      selectedProperty?.physical_address ||
      selectedProperty?.location ||
      "Ubicación disponible al confirmar",
    [selectedProperty?.physical_address, selectedProperty?.location],
  );

  const priceLabel = useMemo(() => {
    if (selectedProperty?.priceLabel) return selectedProperty.priceLabel;
    if (selectedProperty?.price)
      return typeof selectedProperty.price === "number"
        ? `${selectedProperty.price} MIST`
        : selectedProperty.price;
    return "Por confirmar";
  }, [selectedProperty?.price, selectedProperty?.priceLabel]);

  const propertyIdValue = useMemo(() => {
    if (!selectedProperty?.id) {
      return undefined;
    }
    return typeof selectedProperty.id === "string"
      ? selectedProperty.id
      : selectedProperty.id.id;
  }, [selectedProperty?.id]);

  useEffect(() => {
    if (!isOpen) {
      setStep(0);
      setIsVerifying(false);
      setIsVerified(false);
      setIsConfirming(false);
      setKycSessionId(null);
      setKycError(null);
      if (confirmationTimer.current) {
        clearTimeout(confirmationTimer.current);
        confirmationTimer.current = null;
      }
      if (pollingTimer.current) {
        clearTimeout(pollingTimer.current);
        pollingTimer.current = null;
      }
      if (fallbackVerificationTimer.current) {
        clearTimeout(fallbackVerificationTimer.current);
        fallbackVerificationTimer.current = null;
      }
    }
  }, [isOpen]);

  useEffect(
    () => () => {
      if (confirmationTimer.current) clearTimeout(confirmationTimer.current);
      if (pollingTimer.current) clearTimeout(pollingTimer.current);
      if (fallbackVerificationTimer.current)
        clearTimeout(fallbackVerificationTimer.current);
    },
    [],
  );

  if (!isOpen) {
    return null;
  }

  const startPollingStatus = (sessionId: string, attemptsLeft = 3) => {
    if (pollingTimer.current) {
      clearTimeout(pollingTimer.current);
    }

    pollingTimer.current = setTimeout(async () => {
      try {
        const status = await checkKycStatus(sessionId);

        if (status.status === "verified") {
          setIsVerified(true);
          setStep(1);
          return;
        }

        if (status.status === "rejected") {
          setKycError("La verificación fue rechazada. Intenta nuevamente.");
          return;
        }

        if (attemptsLeft <= 1) {
          // TODO: reemplazar este fallback con eventos reales de OpenID4VP/EUDI.
          if (fallbackVerificationTimer.current) {
            clearTimeout(fallbackVerificationTimer.current);
          }
          fallbackVerificationTimer.current = setTimeout(() => {
            setIsVerified(true);
            setStep(1);
          }, 1000);
          return;
        }

        startPollingStatus(sessionId, attemptsLeft - 1);
      } catch (error) {
        console.error("[kyc] status polling failed", error);
        setKycError(
          error instanceof Error
            ? error.message
            : "No se pudo comprobar el estado de tu verificación.",
        );
      }
    }, 2000);
  };

  const handleVerifyIdentity = async () => {
    if (isVerifying || isVerified) return;
    if (!account?.address) {
      setKycError("Conecta tu wallet para iniciar la verificación.");
      return;
    }

    setKycError(null);
    setIsVerifying(true);
    try {
      const { sessionId } = await startKycSession({
        walletAddress: account.address,
        propertyId: propertyIdValue,
      });

      setKycSessionId(sessionId);

      const status = await checkKycStatus(sessionId);

      if (status.status === "verified") {
        setIsVerified(true);
        setStep(1);
        return;
      }

      if (status.status === "rejected") {
        setKycError("La verificación fue rechazada. Intenta nuevamente.");
        return;
      }

      startPollingStatus(sessionId);
    } catch (error) {
      console.error("[kyc] verification failed", error);
      setKycError(
        error instanceof Error
          ? error.message
          : "No se pudo iniciar la verificación.",
      );
    } finally {
      setIsVerifying(false);
    }
  };

  const handleConfirmReservation = () => {
    if (isConfirming) return;
    setIsConfirming(true);
    confirmationTimer.current = setTimeout(() => {
      setIsConfirming(false);
      setStep(2);
    }, 1200);
  };

  const handleClose = () => {
    setStep(0);
    setIsVerifying(false);
    setIsVerified(false);
    setIsConfirming(false);
    setKycSessionId(null);
    setKycError(null);
    if (pollingTimer.current) {
      clearTimeout(pollingTimer.current);
      pollingTimer.current = null;
    }
    if (fallbackVerificationTimer.current) {
      clearTimeout(fallbackVerificationTimer.current);
      fallbackVerificationTimer.current = null;
    }
    onClose();
  };

  const renderStepContent = () => {
    if (step === 0) {
      return (
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">
              Verificar identidad
            </h3>
            <p className="text-sm text-slate-600">
              Aquí conectaremos OpenID4VP + EUDI para validar tu identidad antes
              de reservar.
            </p>
          </div>
          {isVerified && (
            <div className="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700">
              Identidad verificada ✅
            </div>
          )}
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-medium text-slate-700">
              Este paso se conectará con el backend de identidad y tu wallet
              EUDI para compartir la presentación verificable requerida.
            </p>
          </div>
          {kycSessionId && !isVerified && (
            <p className="text-xs text-slate-500">
              Sesión iniciada: {kycSessionId.slice(0, 8)}...
            </p>
          )}
          {kycError && (
            <p className="text-sm text-red-600">{kycError}</p>
          )}
          <Button
            className="w-full bg-blue-600 hover:bg-blue-700"
            onClick={handleVerifyIdentity}
            disabled={isVerifying}
          >
            {isVerifying ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Verificando...
              </>
            ) : (
              "Verificar identidad"
            )}
          </Button>
        </div>
      );
    }

    if (step === 1) {
      return (
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">
              Confirmar pre-reserva
            </h3>
            <p className="text-sm text-slate-600">
              Revisa los detalles básicos antes de realizar la reserva.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-white p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs uppercase text-slate-400">Propiedad</p>
                <p className="text-base font-semibold text-slate-900">
                  {propertyTitle}
                </p>
              </div>
              <span className="text-sm font-semibold text-blue-600">
                {priceLabel}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <MapPin className="h-4 w-4 text-blue-500" />
              {propertyLocation}
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Wallet className="h-4 w-4 text-blue-500" />
              Pago simulado hasta integrar el contrato final.
            </div>
          </div>
          <Button
            className="w-full bg-blue-600 hover:bg-blue-700"
            onClick={handleConfirmReservation}
            disabled={isConfirming}
          >
            {isConfirming ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Confirmando...
              </>
            ) : (
              "Confirmar pre-reserva (simulado)"
            )}
          </Button>
        </div>
      );
    }

    return (
      <div className="space-y-4 text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
        <div>
          <h3 className="text-xl font-semibold text-slate-900">
            ¡Pre-reserva completada!
          </h3>
          <p className="text-sm text-slate-600">
            Este es un flujo simulado. En la siguiente fase conectaremos la
            lógica on-chain y el backend de identidad.
          </p>
        </div>
        <Button className="w-full" onClick={handleClose}>
          Cerrar
        </Button>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        onClick={handleClose}
      />
      <div className="relative z-10 w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl">
        <div className="mb-6 space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
            Pre-reserva guiada
          </p>
          <h2 className="text-2xl font-semibold text-slate-900">
            {propertyTitle}
          </h2>
        </div>
        <KycStepWizard currentStep={step} steps={STEPS} />
        <div className="mt-8">{renderStepContent()}</div>
      </div>
    </div>
  );
}
