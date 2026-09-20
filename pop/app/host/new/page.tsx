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
import LandingHeader from '@/components/layout/LandingHeader';

export default function HostNewPage() {
  const router = useRouter();
  const { user, isAuthenticated, openAuthModal } = useAuth();

  const initialStatus = user?.verificationStatus || (user?.role === 'HOST' ? 'verified' : 'not_submitted');
  const initialHasSubmitted = initialStatus === 'verified' || initialStatus === 'pending';

  const [currentStep, setCurrentStep] = useState<number>(() => (initialHasSubmitted ? 2 : 1));
  const [maxCompletedStep, setMaxCompletedStep] = useState<number>(() => (initialHasSubmitted ? 1 : 0));
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [hostProfile, setHostProfile] = useState<Record<string, unknown> | null>(null);

  // Derive verification states from profile or active user
  const effectiveStatus = (hostProfile?.verification as Record<string, unknown>)?.status as string || user?.verificationStatus || (user?.role === 'HOST' ? 'verified' : 'not_submitted');
  const isHostVerified = effectiveStatus === 'verified';
  const isHostPending = effectiveStatus === 'pending';
  const hasSubmittedVerification = isHostVerified || isHostPending;

  // Load host profile to verify account status
  useEffect(() => {
    let isMounted = true;
    async function loadProfile() {
      if (user?.id) {
        try {
          const profile = await hostApiClient.getHostProfile() as Record<string, unknown>;
          if (isMounted && profile) {
            setHostProfile(profile);
            const status = (profile.verification as Record<string, unknown>)?.status as string || (user.role === 'HOST' ? 'verified' : 'not_submitted');
            if (status === 'verified' || status === 'pending') {
              setListingData((prev) => ({
                ...prev,
                verification: {
                  ...prev.verification,
                  ownershipConfirmed: true,
                },
              }));
              setCurrentStep((prev) => (prev === 1 ? 2 : prev));
              setMaxCompletedStep((prev) => Math.max(prev, 1));
            }
          }
        } catch (err) {
          console.error('Failed to load host profile in onboarding:', err);
        }
      }
    }
    loadProfile();
    return () => { isMounted = false; };
  }, [user?.id, user?.role]);

  // Initialize listing data with authenticated host identity if available
  const [listingData, setListingData] = useState<ParkingListing>(() => ({
    ...INITIAL_LISTING_STATE,
    hostId: user?.id || null,
    host: {
      ...INITIAL_LISTING_STATE.host,
      name: user?.displayName || '',
      email: user?.email || '',
      phone: user?.phone || '',
    },
    verification: {
      ...INITIAL_LISTING_STATE.verification,
      ownershipConfirmed: initialHasSubmitted,
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
      <LandingHeader
        rightElement={
          <Link href="/host/dashboard" className="btn-back" style={{ textDecoration: 'none' }}>
            Dashboard
          </Link>
        }
      />

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
                  verificationStatus={effectiveStatus}
                  hasSubmittedVerification={hasSubmittedVerification}
                  isHostVerified={isHostVerified}
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
