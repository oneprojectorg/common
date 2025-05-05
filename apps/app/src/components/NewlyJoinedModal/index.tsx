import { Button } from '@op/ui/Button';
import { Header1 } from '@op/ui/Header';
import { Modal } from '@op/ui/Modal';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

const CheckIcon = () => (
  <svg
    width="64"
    height="65"
    viewBox="0 0 64 65"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M31.9997 59.1668C46.7273 59.1668 58.6663 47.2278 58.6663 32.5002C58.6663 17.7726 46.7273 5.8335 31.9997 5.8335C17.2721 5.8335 5.33301 17.7726 5.33301 32.5002C5.33301 47.2278 17.2721 59.1668 31.9997 59.1668Z"
      fill="#D8F3CC"
    />
    <path
      d="M20 32.5L28 40.5L44 24.5"
      stroke="#3EC300"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

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
      className="inset-shadow-none shadow-green"
      isOpen={modalOpen}
      onOpenChange={handleModalChange}
    >
      <div className="p-12 text-center">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col items-center justify-center gap-4">
            <CheckIcon />
            <div className="flex flex-col gap-2">
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
