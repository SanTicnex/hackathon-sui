// src/hooks/useSuiMutations.tsx
import { useState } from 'react';
import { useCurrentAccount, useSignAndExecuteTransaction } from "@mysten/dapp-kit";
import { Transaction } from '@mysten/sui/transactions';

// Tipo base para las mutaciones
type MutationArgs = {
    onSuccess?: (digest: string) => void;
    onError?: (error: string) => void;
};

// ======================================================
// HOOK 1: Transacciones Firmadas por el Usuario (Cliente)
// (Para Reservar, Cancelar, Finalizar)
// ======================================================

export function useClientTransaction(args?: MutationArgs) {
    const { mutate, isPending } = useSignAndExecuteTransaction();
    
    // Función que envuelve la mutación con chequeos y manejo de errores/éxito
    const execute = (tx: Transaction) => {
        if (!tx) {
            args?.onError?.("Transaction object is missing.");
            return;
        }

        mutate({ transaction: tx }, {
            onSuccess: (result) => {
                if (result.effects?.status.status === 'success') {
                    args?.onSuccess?.(result.digest);
                } else {
                    args?.onError?.(`Transaction failed on chain: ${result.effects?.status.error}`);
                }
            },
            onError: (error) => {
                args?.onError?.(error.message);
            }
        });
    };

    return { execute, isPending };
}


// ======================================================
// HOOK 2: Transacciones Firmadas por el Admin (Backend/Gasless)
// (Para Crear Inmueble)
// ======================================================

type AdminMutationData = {
    name: string;
    price: string;
    address: string;
};

export function useAdminTransaction(args?: MutationArgs) {
    const [isPending, setIsPending] = useState(false);
    const account = useCurrentAccount(); // Usamos esto para obtener la dirección del promotor

    const mutate = async (formData: AdminMutationData) => {
        if (!account) {
            args?.onError?.("Wallet must be connected to set the promoter address.");
            return;
        }

        setIsPending(true);

        try {
            const response = await fetch("/api/create-property", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...formData,
                    promoterAddress: account.address,
                }),
            });

            const data = await response.json();

            if (data.success) {
                args?.onSuccess?.(data.digest);
            } else {
                args?.onError?.(data.error || "Transaction failed on the server.");
            }
        } catch (err: any) {
            args?.onError?.(err.message || "Network or API call failed.");
        } finally {
            setIsPending(false);
        }
    };

    return { mutate, isPending };
}