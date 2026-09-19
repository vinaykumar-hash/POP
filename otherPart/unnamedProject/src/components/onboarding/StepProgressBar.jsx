import React from 'react';

const STEPS = [
  { id: 1, label: 'Verification' },
  { id: 2, label: 'Photos' },
  { id: 3, label: 'Location' },
  { id: 4, label: 'Details' },
  { id: 5, label: 'Pricing & Hours' },
  { id: 6, label: 'Review' },
];

export default function StepProgressBar({ currentStep, maxCompletedStep, onStepClick }) {
  return (
    <nav className="onboarding-stepper" aria-label="Onboarding Progress">
      <div className="stepper-track">
        {STEPS.map((step) => {
          const isCompleted = step.id < currentStep;
          const isCurrent = step.id === currentStep;
          const isClickable = step.id <= maxCompletedStep + 1 && step.id <= currentStep;

          return (
            <button
              key={step.id}
              type="button"
              className={`stepper-item ${isCurrent ? 'current' : ''} ${isCompleted ? 'completed' : ''}`}
              onClick={() => isClickable && onStepClick(step.id)}
              disabled={!isClickable}
              aria-current={isCurrent ? 'step' : undefined}
              aria-label={`Step ${step.id}: ${step.label} ${isCompleted ? '(Completed)' : isCurrent ? '(Current)' : ''}`}
            >
              <span className="stepper-bubble">
                {isCompleted ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  step.id
                )}
              </span>
              <span className="stepper-label">{step.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
