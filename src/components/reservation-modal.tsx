"use client"

import React, { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Loader2, ShieldCheck, CheckCircle2 } from "lucide-react" 
import { cn } from "@/lib/utils" 

interface ReservationModalProps {
  isOpen: boolean
  onClose: () => void
  onVerify?: () => void
  onReserve?: () => void
}

type Step = 1 | 2 

export const ReservationModal: React.FC<ReservationModalProps> = ({ isOpen, onClose, onVerify, onReserve }) => {
  const [step, setStep] = useState<Step>(1)
  const [isVerifying, setIsVerifying] = useState(false)
  const [isVerified, setIsVerified] = useState(false)


  const handleVerifyIdentity = () => {
    setIsVerifying(true)
    onVerify && onVerify() 


    setTimeout(() => {
      setIsVerifying(false)
      setIsVerified(true)
      setTimeout(() => setStep(2), 1000) 
    }, 2000) 
  }


  const handleReserveProperty = () => {
    onReserve && onReserve()
    onClose() 
  }

  const handleBack = () => {
    if (step === 2) {
      setStep(1)
      setIsVerified(false)
    }
    else onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Reserve Property</DialogTitle>
          <DialogDescription>
            {step === 1 ? "Step 1: Identity Verification is required to proceed." : "Step 2: Confirm your reservation details."}
          </DialogDescription>
        </DialogHeader>
        {step === 1 ? (
          <div className="flex flex-col gap-6 items-center text-center py-4">
            
            <div
                className={cn(
                  "relative h-24 w-24 rounded-full flex items-center justify-center transition-all duration-500",
                  isVerified 
                    ? "bg-secondary/20 text-secondary" 
                    : isVerifying 
                      ? "bg-primary/20 text-primary" 
                      : "bg-primary/10 text-primary",
                )}
              >
                {isVerifying && (
                  <>
                    <div className="absolute inset-0 rounded-full bg-primary/30 animate-ping duration-2000" />
                  </>
                )}
                
                <div className="relative z-10 h-16 w-16 rounded-full bg-card flex items-center justify-center">
                  {isVerifying ? (
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  ) : isVerified ? (
                    <CheckCircle2 className="h-8 w-8 text-secondary" />
                  ) : (
                    <ShieldCheck className="h-8 w-8 text-primary" />
                  )}
                </div>
              </div>

            <div className="space-y-1">
              <h3 className="font-semibold text-lg">
                {isVerifying ? "Verification in Progress..." : isVerified ? "Identity Verified" : "OpenID4VP + EUDI Wallet"}
              </h3>
              <p className="text-sm text-muted-foreground">
                {isVerifying
                    ? "Please approve the request in your EUDI Wallet."
                    : isVerified
                      ? "Identity successfully confirmed. Proceed to reservation."
                      : "Verify your identity using your EUDI Wallet credentials."}
              </p>
            </div>

            <Button 
                className="w-full max-w-xs" 
                onClick={handleVerifyIdentity} 
                disabled={isVerifying || isVerified} 
            >
              {isVerifying ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : isVerified ? (
                "Verified! Proceeding..."
              ) : (
                "Verify Identity"
              )}
            </Button>
          </div>
        ) : (
          /* ---  Confirm Reservation --- */
          <div className="space-y-4 py-4">
            <p className="text-center text-lg font-medium">Step 2: Confirm Reservation & Sign Transaction</p>
            
            <div className="rounded-xl border p-4 text-sm space-y-2">
                <p className="font-semibold">Transaction Details</p>
                <div className="flex justify-between border-t pt-2">
                    <span className="text-muted-foreground">Deposit Amount</span>
                    <span className="font-bold text-primary">€300.00</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-muted-foreground">Lock Period</span>
                    <span>24 Hours</span>
                </div>
            </div>

            <Button className="w-full" onClick={handleReserveProperty}>
              Confirm Reservation
            </Button>
          </div>
        )}

        <div className="flex justify-between mt-6">
          <Button variant="outline" onClick={handleBack}>
            {step === 1 ? "Cancel" : "Back"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}