import React, { useState } from 'react';
import { useAuth } from '@apartment-security/shared-auth';
import ResidentRegistrationFlow from './ResidentRegistrationFlow';
import ApprovalPendingScreen from './ApprovalPendingScreen';

export default function ResidentOnboardingScreen() {
  const { userProfile, logout } = useAuth();
  const [submissionData, setSubmissionData] = useState<any | null>(null);

  if (submissionData || userProfile?.status === 'PENDING') {
    return (
      <ApprovalPendingScreen
        flatNumber={userProfile?.flat || submissionData?.flat}
        tower={userProfile?.wing || submissionData?.building?.replace(/^Block\s*/i, '')}
        societyName={userProfile?.propertyName || submissionData?.society}
        submittedAt={submissionData?.submittedAt}
        email={userProfile?.email || submissionData?.email}
        onGoToLogin={async () => {
          await logout();
        }}
        onSwitchAccount={async () => {
          await logout();
        }}
      />
    );
  }

  return (
    <ResidentRegistrationFlow
      onCompleteRegistration={(data) => setSubmissionData(data)}
    />
  );
}

