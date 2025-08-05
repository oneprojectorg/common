'use client';

import { useState } from 'react';
import {
  Modal,
  ModalBody,
  ModalHeader,
  ModalStepper,
} from '@op/ui/Modal';
import { TextField } from '@op/ui/TextField';
import { Button } from '@op/ui/Button';
import { LuX } from 'react-icons/lu';

interface CreateProcessModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface FormData {
  processName: string;
  description: string;
  totalBudget: string;
}

export const CreateProcessModal = ({ isOpen, onClose }: CreateProcessModalProps) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<FormData>({
    processName: '',
    description: '',
    totalBudget: '',
  });

  const totalSteps = 5;

  const handleNext = (step: number) => {
    // Basic validation for step 1
    if (currentStep === 1) {
      if (!formData.processName.trim() || !formData.totalBudget.trim()) {
        // TODO: Show validation errors
        return;
      }
    }
    setCurrentStep(step);
  };

  const handlePrevious = (step: number) => {
    setCurrentStep(step);
  };

  const handleFinish = () => {
    // TODO: Submit form data
    console.log('Form data:', formData);
    onClose();
  };

  const updateFormData = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="flex flex-col gap-6">
            <p className="text-base text-neutral-charcoal">
              Define the key details for your decision process.
            </p>
            
            <div className="flex flex-col gap-4">
              <TextField
                label="Process Name"
                isRequired
                inputProps={{ placeholder: "e.g., 2025 Community Budget" }}
                value={formData.processName}
                onChange={(value) => updateFormData('processName', value)}
              />
              
              <TextField
                label="Description"
                useTextArea
                textareaProps={{ placeholder: "Description for your decision-making process" }}
                value={formData.description}
                onChange={(value) => updateFormData('description', value)}
              />
              
              <TextField
                label="Total Budget Available"
                isRequired
                inputProps={{ placeholder: "$0.00" }}
                description="The total amount available this funding round."
                value={formData.totalBudget}
                onChange={(value) => updateFormData('totalBudget', value)}
              />
            </div>
          </div>
        );
      
      default:
        return (
          <div className="flex flex-col items-center justify-center py-8">
            <p className="text-center text-neutral-gray4">
              Step {currentStep} content coming soon...
            </p>
          </div>
        );
    }
  };

  return (
    <Modal isOpen={isOpen} onOpenChange={onClose}>
      <div className="flex h-full max-h-[90vh] w-full max-w-lg flex-col">
        <ModalHeader className="relative flex items-center justify-between">
          <span className="font-serif text-title-sm text-neutral-black">
            Set up your decision-making process
          </span>
          <Button
            color="secondary"
            surface="ghost"
            size="small"
            onPress={onClose}
            className="absolute right-0 top-0 p-2"
          >
            <LuX className="size-6" />
          </Button>
        </ModalHeader>
        
        <ModalBody className="flex-1 overflow-y-auto">
          {renderStepContent()}
        </ModalBody>
        
        <ModalStepper
          initialStep={1}
          totalSteps={totalSteps}
          onNext={handleNext}
          onPrevious={handlePrevious}
          onFinish={handleFinish}
        />
      </div>
    </Modal>
  );
};