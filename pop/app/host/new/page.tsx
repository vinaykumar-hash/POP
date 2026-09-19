'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { hostApiClient } from '@/services/host/apiClient';
import { INITIAL_LISTING_STATE, type ParkingListing } from '@/types/listingModel';
import StepProgressBar from '@/components/host/onboarding/StepProgressBar';
import Step1Verification from '@/components/host/onboarding/Step1Verification';
import Step2Photos from '@/components/host/onboarding/Step2Photos';
import Step3Location from '@/components/host/onboarding/Step3Location';
import Step4ParkingDetails from '@/components/host/onboarding/Step4ParkingDetails';
import Step5PricingAvailability from '@/components/host/onboarding/Step5PricingAvailability';
import Step6Review from '@/components/host/onboarding/Step6Review';
import SubmissionSuccess from '@/components/host/onboarding/SubmissionSuccess';

export default function HostNewPage() {
  const router = useRouter();
  const { user, isAuthenticated, openAuthModal } = useAuth();

  const [currentStep, setCurrentStep] = useState(1);
  const [maxCompletedStep, setMaxCompletedStep] = useState(0);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Initialize listing data with authenticated host identity if available
  const [listingData, setListingData] = useState<ParkingListing>(() => ({
    ...INITIAL_LISTING_STATE,
    hostId: user?.id || null,
    host: {
      ...INITIAL_LISTING_STATE.host,
      name: user?.displayName || '',
      email: user?.email || '',
      phone: '',
    },
  }));

  // Sync authenticated user identity if it changes or loads
  useEffect(() => {
    if (user?.id) {
      setListingData((prev) => ({
        ...prev,
        hostId: user.id,
        host: {
          ...prev.host,
          name: prev.host.name || user.displayName || '',
          email: prev.host.email || user.email || '',
          phone: prev.host.phone || '',
        },
      }));
    }
  }, [user]);

  const handleStepClick = (stepId: number) => {
    setCurrentStep(stepId);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNextStep = () => {
    setMaxCompletedStep((prev) => Math.max(prev, currentStep));
    setCurrentStep((prev) => Math.min(6, prev + 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePreviousStep = () => {
    if (currentStep === 1) {
      router.push('/list');
    } else {
      setCurrentStep((prev) => Math.max(1, prev - 1));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleEditFromReview = (stepNumber: number) => {
    setCurrentStep(stepNumber);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmitListing = async () => {
    if (!isAuthenticated) {
      openAuthModal();
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const payload: Partial<ParkingListing> = {
        host: {
          name: listingData.host.name,
          email: listingData.host.email,
          phone: listingData.host.phone,
          verificationStatus: 'pending',
        },
        verification: {
          document: listingData.verification.document,
          documentKey: listingData.verification.document?.name
            ? `hosts/pending/verification/${listingData.verification.document.name}`
            : undefined,
          ownershipConfirmed: listingData.verification.ownershipConfirmed,
          status: 'pending',
        },
        photos: listingData.photos.map((p, idx) => ({
          key: `hosts/pending/listings/photos/${p.name || `photo_${idx + 1}.jpg`}`,
          previewUrl: p.previewUrl,
          name: p.name,
          size: p.size,
        })),
        location: { ...listingData.location },
        parkingDetails: { ...listingData.parkingDetails },
        pricing: { ...listingData.pricing },
        availability: { ...listingData.availability },
        status: 'pending_review',
      };

      const createdListing = await hostApiClient.createListing<ParkingListing>(payload as Record<string, unknown>);

      setListingData(createdListing);
      setIsSubmitted(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      setSubmitError(err.message || 'Failed to submit listing. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="landing-page">
      <header className="landing-header">
        <Link href="/" className="landing-brand">
          <span className="landing-brand-badge">P</span>
          <span className="landing-brand-text">
            <span>POP</span>
            <span className="landing-brand-sub">Parking on phone</span>
          </span>
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link href="/host/dashboard" className="btn-back" style={{ textDecoration: 'none' }}>
            Dashboard
          </Link>
        </div>
      </header>

      <main className="main-content">
        {isSubmitted ? (
          <SubmissionSuccess listingData={listingData} />
        ) : (
          <section className="onboarding-page-container" aria-label="Host Onboarding Flow">
            {/* Top Stepper Progress */}
            <StepProgressBar
              currentStep={currentStep}
              maxCompletedStep={maxCompletedStep}
              onStepClick={handleStepClick}
            />

            {/* Dynamic Step Content */}
            <div className="onboarding-step-wrapper">
              {currentStep === 1 && (
                <Step1Verification
                  data={listingData}
                  onChange={setListingData}
                  onContinue={handleNextStep}
                />
              )}

              {currentStep === 2 && (
                <Step2Photos
                  data={listingData}
                  onChange={setListingData}
                  onContinue={handleNextStep}
                  onBack={handlePreviousStep}
                />
              )}

              {currentStep === 3 && (
                <Step3Location
                  data={listingData}
                  onChange={setListingData}
                  onContinue={handleNextStep}
                  onBack={handlePreviousStep}
                />
              )}

              {currentStep === 4 && (
                <Step4ParkingDetails
                  data={listingData}
                  onChange={setListingData}
                  onContinue={handleNextStep}
                  onBack={handlePreviousStep}
                />
              )}

              {currentStep === 5 && (
                <Step5PricingAvailability
                  data={listingData}
                  onChange={setListingData}
                  onContinue={handleNextStep}
                  onBack={handlePreviousStep}
                />
              )}

              {currentStep === 6 && (
                <Step6Review
                  data={listingData}
                  onEditStep={handleEditFromReview}
                  onSubmit={handleSubmitListing}
                  onBack={handlePreviousStep}
                  isSubmitting={isSubmitting}
                  apiError={submitError}
                />
              )}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
