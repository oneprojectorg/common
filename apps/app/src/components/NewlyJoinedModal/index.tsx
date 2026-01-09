'use client';

import { Button } from '@op/ui/Button';
import { CheckIcon } from '@op/ui/CheckIcon';
import { Header1 } from '@op/ui/Header';
import { Modal } from '@op/ui/Modal';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

export const NewlyJoinedModal = () => {
  const searchParams = useSearchParams();
  const router = useRouter();
  const isNew = searchParams.get('new');
  const [modalOpen, setModalOpen] = useState(!!isNew);

  useEffect(() => {
    setModalOpen(!!isNew);
  }, [isNew]);

  const handleModalChange = (open: boolean) => {
    setModalOpen(open);

    if (!open && isNew) {
      // Remove 'new' param from URL
      const params = new URLSearchParams(window.location.search);

      params.delete('new');
      const newUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}`;

      router.replace(newUrl);
    }
  };

  return (
    <Modal
      className="shadow-green inset-shadow-none"
      isOpen={modalOpen}
      onOpenChange={handleModalChange}
      confetti={false}
    >
      <div className="p-12 z-10 text-center">
        <div className="gap-6 flex flex-col">
          <div className="gap-4 flex flex-col items-center justify-center">
            <CheckIcon />
            <div className="gap-2 flex flex-col">
              <Header1 className="sm:text-title-lg">You're all set!</Header1>
              You've successfully joined Common. Your organization's profile is
              now visible to aligned collaborators and funders.
            </div>
          </div>
          <Button className="w-full" onPress={() => handleModalChange(false)}>
            Take me to Common
          </Button>
        </div>
      </div>
    </Modal>
  );
};
