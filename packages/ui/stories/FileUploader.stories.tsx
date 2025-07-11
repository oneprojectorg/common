import { FileUploader } from '../src/components/FileUploader';
import { Toast, toast } from '../src/components/Toast';

export default {
  title: 'FileUploader',
  component: FileUploader,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    maxFiles: {
      control: 'number',
    },
    maxSizePerFile: {
      control: 'number',
    },
    acceptedTypes: {
      control: 'object',
    },
    enableDragAndDrop: {
      control: 'boolean',
    },
  },
};

// Mock upload function for stories
const mockUpload = async (file: File) => {
  // Simulate upload delay
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  return {
    id: Math.random().toString(36).substr(2, 9),
    url: URL.createObjectURL(file),
    fileName: file.name,
    mimeType: file.type,
    fileSize: file.size,
  };
};

export const Example = () => (
  <div className="w-full max-w-2xl space-y-8">
    <Toast />
    
    <div className="space-y-4">
      <h3 className="font-medium">Basic File Uploader</h3>
      <FileUploader
        onUpload={mockUpload}
        onRemove={(id) => {
          console.log('Removing file:', id);
          toast.success({ title: 'File removed' });
        }}
      />
    </div>
    
    <div className="space-y-4">
      <h3 className="font-medium">With Custom Limits</h3>
      <FileUploader
        onUpload={mockUpload}
        maxFiles={3}
        maxSizePerFile={1024 * 1024} // 1MB
        onRemove={(id) => {
          console.log('Removing file:', id);
          toast.success({ title: 'File removed' });
        }}
      />
    </div>
    
    <div className="space-y-4">
      <h3 className="font-medium">Images Only</h3>
      <FileUploader
        onUpload={mockUpload}
        acceptedTypes={['image/png', 'image/jpeg', 'image/webp']}
        maxFiles={2}
        onRemove={(id) => {
          console.log('Removing file:', id);
          toast.success({ title: 'File removed' });
        }}
      />
    </div>
    
    <div className="space-y-4">
      <h3 className="font-medium">With Drag and Drop</h3>
      <FileUploader
        onUpload={mockUpload}
        enableDragAndDrop={true}
        dragOverlay={
          <div className="text-center text-teal">
            Drop files here to upload
          </div>
        }
        onRemove={(id) => {
          console.log('Removing file:', id);
          toast.success({ title: 'File removed' });
        }}
      />
    </div>
  </div>
);

export const BasicUploader = () => (
  <div className="space-y-4">
    <Toast />
    <FileUploader
      onUpload={mockUpload}
      onRemove={(id) => {
        console.log('Removing file:', id);
        toast.success({ title: 'File removed' });
      }}
    />
  </div>
);

export const ImagesOnly = () => (
  <div className="space-y-4">
    <Toast />
    <FileUploader
      onUpload={mockUpload}
      acceptedTypes={['image/png', 'image/jpeg', 'image/webp', 'image/gif']}
      maxFiles={3}
      onRemove={(id) => {
        console.log('Removing file:', id);
        toast.success({ title: 'Image removed' });
      }}
    />
  </div>
);

export const WithDragAndDrop = () => (
  <div className="space-y-4">
    <Toast />
    <FileUploader
      onUpload={mockUpload}
      enableDragAndDrop={true}
      dragOverlay={
        <div className="border-2 border-dashed border-teal rounded-lg p-8 text-center">
          <div className="text-teal font-medium">Drop files here</div>
          <div className="text-sm text-neutral-600">or click to browse</div>
        </div>
      }
      onRemove={(id) => {
        console.log('Removing file:', id);
        toast.success({ title: 'File removed' });
      }}
    />
  </div>
);

export const SingleFile = () => (
  <div className="space-y-4">
    <Toast />
    <FileUploader
      onUpload={mockUpload}
      maxFiles={1}
      onRemove={(id) => {
        console.log('Removing file:', id);
        toast.success({ title: 'File removed' });
      }}
    />
  </div>
);

export const SmallFilesOnly = () => (
  <div className="space-y-4">
    <Toast />
    <FileUploader
      onUpload={mockUpload}
      maxSizePerFile={512 * 1024} // 512KB
      onRemove={(id) => {
        console.log('Removing file:', id);
        toast.success({ title: 'File removed' });
      }}
    />
  </div>
);