import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../services/apiClient';
import { INITIAL_LISTING_STATE } from '../types/listingModel';
import StepProgressBar from '../components/onboarding/StepProgressBar';
import Step1Verification from '../components/onboarding/Step1Verification';
import Step2Photos from '../components/onboarding/Step2Photos';
import Step3Location from '../components/onboarding/Step3Location';
import Step4ParkingDetails from '../components/onboarding/Step4ParkingDetails';
import Step5PricingAvailability from '../components/onboarding/Step5PricingAvailability';
import Step6Review from '../components/onboarding/Step6Review';
import SubmissionSuccess from '../components/onboarding/SubmissionSuccess';

export default function NewHostOnboarding() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const initialStatus = user?.verificationStatus || 'not_submitted';
  const initialHasSubmitted = initialStatus === 'verified' || initialStatus === 'pending';

  const [currentStep, setCurrentStep] = useState(() => (initialHasSubmitted ? 2 : 1));
  const [maxCompletedStep, setMaxCompletedStep] = useState(() => (initialHasSubmitted ? 1 : 0));
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [hostProfile, setHostProfile] = useState(null);

  // Derive verification states from profile or active user
  const effectiveStatus = hostProfile?.verification?.status || user?.verificationStatus || 'not_submitted';
  const isHostVerified = effectiveStatus === 'verified';
  const isHostPending = effectiveStatus === 'pending';
  const hasSubmittedVerification = isHostVerified || isHostPending;

  // Load host profile to verify account status
  useEffect(() => {
    let isMounted = true;
    async function loadProfile() {
      if (user?.id) {
        try {
          const profile = await apiClient.getHostProfile();
          if (isMounted && profile) {
            setHostProfile(profile);
            const status = profile.verification?.status || 'not_submitted';
            if (status === 'verified' || status === 'pending') {
              setListingData((prev) => ({
                ...prev,
                verification: {
                  ...prev.verification,
                  ownershipConfirmed: true
                }
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
  }, [user?.id]);

  // Initialize listing data with authenticated host identity (never user-entered hostId)
  const [listingData, setListingData] = useState(() => ({
    ...INITIAL_LISTING_STATE,
    hostId: user?.id || null,
    host: {
      ...INITIAL_LISTING_STATE.host,
      name: user?.name || '',
      email: user?.email || '',
      phone: user?.phone || ''
    },
    verification: {
      ...INITIAL_LISTING_STATE.verification,
      ownershipConfirmed: initialHasSubmitted
    }
  }));

  // For hosts who have already submitted verification, skip Step 1 directly to Step 2 (Photos)
  useEffect(() => {
    if (hasSubmittedVerification && currentStep === 1 && maxCompletedStep === 0) {
      setCurrentStep(2);
      setMaxCompletedStep(1);
    }
  }, [hasSubmittedVerification, currentStep, maxCompletedStep]);

  // Sync authenticated user identity if it changes or loads
  useEffect(() => {
    if (user?.id) {
      setListingData((prev) => ({
        ...prev,
        hostId: user.id, // Strictly derived from authenticated session
        host: {
          ...prev.host,
          name: prev.host.name || user.name || '',
          email: prev.host.email || user.email || '',
          phone: prev.host.phone || user.phone || ''
        }
      }));
    }
  }, [user]);

  // Allow jumping to a specific step
  const handleStepClick = (stepId) => {
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
      navigate('/host/dashboard');
    } else if (currentStep === 2 && hasSubmittedVerification) {
      navigate('/host/dashboard');
    } else {
      setCurrentStep((prev) => Math.max(1, prev - 1));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleEditFromReview = (stepNumber) => {
    setCurrentStep(stepNumber);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  const handleSubmitListing = async () => {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      // Build API payload without trusting client hostId
      const payload = {
        host: {
          name: listingData.host.name,
          email: listingData.host.email,
          phone: listingData.host.phone
        },
        verification: {
          documentKey: listingData.verification.document?.name 
            ? `hosts/pending/verification/${listingData.verification.document.name}` 
            : (hostProfile?.verification?.documentKey || null),
          ownershipConfirmed: listingData.verification.ownershipConfirmed,
          status: hostProfile?.verification?.status || (listingData.verification.document ? 'pending' : 'pending')
        },
        photos: listingData.photos.map((p, idx) => ({
          key: `hosts/pending/listings/photos/${p.name || `photo_${idx + 1}.jpg`}`,
          url: p.previewUrl
        })),
        location: { ...listingData.location },
        parkingDetails: { ...listingData.parkingDetails },
        pricing: { ...listingData.pricing },
        availability: { ...listingData.availability }
      };

      const createdListing = await apiClient.createListing(payload);

      // If host had not previously submitted verification, persist pending status
      if (!hasSubmittedVerification) {
        try {
          await apiClient.updateHostProfile({
            verification: {
              status: 'pending',
              documentKey: payload.verification.documentKey,
              submittedAt: new Date().toISOString()
            }
          });
        } catch (e) {
          console.error('Failed to update host profile verification status:', e);
        }
      }

      setListingData(createdListing);
      setIsSubmitted(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setSubmitError(err.message || 'Failed to submit listing. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return <SubmissionSuccess listingData={listingData} />;
  }

  return (
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
  );
}
