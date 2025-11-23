"use client";

import { cn } from "@/lib/utils";

type Step = {
  id: number;
  label: string;
  description?: string;
};

interface KycStepWizardProps {
  currentStep: number;
  steps: Step[];
}

export function KycStepWizard({ currentStep, steps }: KycStepWizardProps) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-6 md:flex-row">
        {steps.map((step, index) => {
          const isActive = currentStep === step.id;
          const isCompleted = currentStep > step.id;

          return (
            <div key={step.id} className="flex items-center md:flex-1">
              <div className="flex items-center gap-4">
                <div
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-full border text-sm font-semibold transition-colors",
                    isCompleted &&
                      "border-emerald-500 bg-emerald-500 text-white shadow",
                    isActive &&
                      !isCompleted &&
                      "border-blue-600 text-blue-600 shadow-sm",
                    !isActive &&
                      !isCompleted &&
                      "border-slate-200 bg-white text-slate-400",
                  )}
                >
                  {step.id + 1}
                </div>
                <div className="space-y-1">
                  <p
                    className={cn(
                      "text-sm font-semibold",
                      isCompleted || isActive
                        ? "text-slate-900"
                        : "text-slate-500",
                    )}
                  >
                    {step.label}
                  </p>
                  {step.description && (
                    <p className="text-xs text-slate-500">{step.description}</p>
                  )}
                </div>
              </div>
              {index < steps.length - 1 && (
                <div className="ml-4 hidden flex-1 border-t border-dashed border-slate-200 md:block" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
