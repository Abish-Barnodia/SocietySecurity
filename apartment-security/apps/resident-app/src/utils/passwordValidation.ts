export interface PasswordValidationResult {
  isValid: boolean;
  hasUpper: boolean;
  hasNumber: boolean;
  hasSpecial: boolean;
  hasMinLength: boolean;
  errorMessage?: string;
}

export const validatePassword = (password: string): PasswordValidationResult => {
  const hasUpper = /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(password);
  const hasMinLength = password.length >= 8;

  const isValid = hasUpper && hasNumber && hasSpecial && hasMinLength;

  let errorMessage = '';
  if (!isValid) {
    const missing: string[] = [];
    if (!hasMinLength) missing.push('at least 8 characters');
    if (!hasUpper) missing.push('one uppercase letter (A-Z)');
    if (!hasNumber) missing.push('one number (0-9)');
    if (!hasSpecial) missing.push('one special character (!@#$%^&*)');
    errorMessage = `Password must contain ${missing.join(', ')}.`;
  }

  return {
    isValid,
    hasUpper,
    hasNumber,
    hasSpecial,
    hasMinLength,
    errorMessage,
  };
};
