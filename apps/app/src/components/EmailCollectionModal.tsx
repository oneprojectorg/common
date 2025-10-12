'use client';

import { Button } from '@op/ui/Button';
import { Form } from '@op/ui/Form';
import { LoadingSpinner } from '@op/ui/LoadingSpinner';
import { TextField } from '@op/ui/TextField';
import { useState } from 'react';

interface EmailCollectionModalProps {
  isOpen: boolean;
  partialSessionId: string;
  onComplete: () => void;
  onClose: () => void;
}

export function EmailCollectionModal({
  isOpen,
  partialSessionId,
  onComplete,
  onClose,
}: EmailCollectionModalProps) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {

    if (!email) {
      setError('Email is required');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email)) {
      setError('Invalid email format');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/atproto/complete-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          partialSessionId,
          email,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        onComplete();
        window.location.href = data.redirectUrl;
      } else {
        setError(data.error || 'Failed to complete signup');
        setIsLoading(false);
      }
    } catch (err) {
      setError('Failed to connect to server');
      setIsLoading(false);
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-xl font-semibold">Email Required</h2>

        <div className="flex flex-col gap-4">
          <p className="text-sm text-gray-600">
            Your Bluesky profile doesn't include a public email address. Please
            provide your email to complete signup.
          </p>

          {error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <Form onSubmit={(e) => {
            e.preventDefault();
            void handleSubmit();
          }}>
            <TextField
              aria-label="Email"
              label="Email address"
              isRequired
              inputProps={{
                placeholder: 'you@example.com',
                spellCheck: false,
                type: 'email',
              }}
              // eslint-disable-next-line jsx-a11y/no-autofocus
              autoFocus
              value={email}
              onChange={(val) => {
                setEmail(val);
                setError(null);
              }}
              isDisabled={isLoading}
            />
          </Form>

          <div className="flex justify-end gap-2">
            <Button
              onPress={onClose}
              color="secondary"
              isDisabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              onPress={() => void handleSubmit()}
              isDisabled={!email || isLoading}
            >
              {isLoading ? <LoadingSpinner /> : 'Continue'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
