"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Button } from "@/components/ui/button";
import { KycStepWizard } from "./KycStepWizard";
import { CheckCircle2, Loader2, MapPin, Wallet } from "lucide-react";

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
  { id: 1, label: "Verificar identidad", description: "EUDI / OpenID4VP" },
  { id: 2, label: "Confirmar pre-reserva" },
  { id: 3, label: "Resultado" },
];

export function PreReserveModal({
  isOpen,
  onClose,
  selectedProperty,
}: PreReserveModalProps) {
  const [step, setStep] = useState(0);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const verificationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const confirmationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const resetFlow = useCallback(() => {
    setStep(0);
    setIsVerifying(false);
    setIsConfirming(false);
    if (verificationTimer.current) {
      clearTimeout(verificationTimer.current);
      verificationTimer.current = null;
    }
    if (confirmationTimer.current) {
      clearTimeout(confirmationTimer.current);
      confirmationTimer.current = null;
    }
  }, []);

  useEffect(() => {
    if (!isOpen) {
      resetFlow();
    }
  }, [isOpen, resetFlow]);

  useEffect(
    () => () => {
      if (verificationTimer.current) clearTimeout(verificationTimer.current);
      if (confirmationTimer.current) clearTimeout(confirmationTimer.current);
    },
    [],
  );

  if (!isOpen) {
    return null;
  }

  const handleSimulateVerification = () => {
    if (isVerifying) return;
    setIsVerifying(true);
    verificationTimer.current = setTimeout(() => {
      setIsVerifying(false);
      setStep(1);
    }, 1500);
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
    resetFlow();
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
              Aquí conectaremos el flujo EUDI / OpenID4VP con el backend de
              identidad. Por ahora es una simulación.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-medium text-slate-700">
              Cuando esté listo, este paso iniciará la autenticación segura con
              tu wallet EUDI y validará los credenciales requeridos por el
              promotor.
            </p>
          </div>
          <Button
            className="w-full bg-blue-600 hover:bg-blue-700"
            onClick={handleSimulateVerification}
            disabled={isVerifying}
          >
            {isVerifying ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Verificando...
              </>
            ) : (
              "Simular verificación KYC"
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
