import { MediaDisplay } from '../src/components/MediaDisplay';

export default {
  title: 'MediaDisplay',
  component: MediaDisplay,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    title: {
      control: 'text',
    },
    author: {
      control: 'text',
    },
    description: {
      control: 'text',
    },
    url: {
      control: 'text',
    },
    site: {
      control: 'text',
    },
    mimeType: {
      control: 'text',
    },
    size: {
      control: 'number',
    },
  },
};

export const Example = () => (
  <div className="w-full max-w-md space-y-8">
    <div className="space-y-4">
      <h3 className="font-medium">PDF Document</h3>
      <MediaDisplay
        title="Research Paper: AI in Healthcare"
        author="Dr. Jane Smith"
        description="A comprehensive study on the applications of artificial intelligence in modern healthcare systems, including machine learning algorithms for diagnosis and treatment recommendations."
        url="https://example.com/research-paper.pdf"
        mimeType="application/pdf"
        size={2048000}
      >
        <div className="flex aspect-video items-center justify-center rounded-t-lg bg-neutral-gray1">
          <div className="text-center">
            <div className="mb-2 text-6xl">📄</div>
            <div className="text-sm text-neutral-gray4">PDF Preview</div>
          </div>
        </div>
      </MediaDisplay>
    </div>

    <div className="space-y-4">
      <h3 className="font-medium">Web Link</h3>
      <MediaDisplay
        title="GitHub Repository"
        description="A collection of React components built with TypeScript and Tailwind CSS."
        url="https://github.com/example/react-components"
        site="github.com"
      >
        <div className="flex aspect-video items-center justify-center rounded-t-lg bg-neutral-gray1">
          <div className="text-center">
            <div className="mb-2 text-6xl">🔗</div>
            <div className="text-sm text-neutral-gray4">Web Preview</div>
          </div>
        </div>
      </MediaDisplay>
    </div>

    <div className="space-y-4">
      <h3 className="font-medium">Image Media</h3>
      <MediaDisplay
        title="Beautiful Landscape"
        author="John Photographer"
        description="A stunning view of mountains during golden hour."
        url="https://example.com/landscape.jpg"
      >
        <img
          src="https://images.unsplash.com/photo-1506905925346-21bda4d32df4?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80"
          alt="Beautiful landscape"
          className="aspect-video w-full rounded-t-lg object-cover"
        />
      </MediaDisplay>
    </div>
  </div>
);

export const PDFDocument = {
  args: {
    title: 'Technical Documentation',
    author: 'Engineering Team',
    description:
      'Complete technical documentation for the API including endpoints, authentication, and usage examples.',
    url: 'https://example.com/docs.pdf',
    mimeType: 'application/pdf',
    size: 1024000,
    children: (
      <div className="flex aspect-video items-center justify-center rounded-t-lg bg-neutral-gray1">
        <div className="text-center">
          <div className="mb-2 text-6xl">📋</div>
          <div className="text-sm text-neutral-gray4">PDF Document</div>
        </div>
      </div>
    ),
  },
};

export const WebLink = {
  args: {
    title: 'Example Website',
    description: 'A demo website showcasing modern web development techniques.',
    url: 'https://example.com',
    site: 'example.com',
    children: (
      <div className="flex aspect-video items-center justify-center rounded-t-lg bg-neutral-gray1">
        <div className="text-center">
          <div className="mb-2 text-6xl">🌐</div>
          <div className="text-sm text-neutral-gray4">Website Preview</div>
        </div>
      </div>
    ),
  },
};

export const ImageMedia = {
  args: {
    title: 'Sample Image',
    author: 'Photographer',
    description: 'A beautiful sample image for demonstration purposes.',
    url: 'https://example.com/image.jpg',
    children: (
      <img
        src="https://images.unsplash.com/photo-1441974231531-c6227db76b6e?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80"
        alt="Sample"
        className="aspect-video w-full rounded-t-lg object-cover"
      />
    ),
  },
};

export const MinimalContent = {
  args: {
    title: 'Simple Title',
    url: 'https://example.com/simple',
    children: (
      <div className="flex aspect-video items-center justify-center rounded-t-lg bg-neutral-gray1">
        <div className="text-center">
          <div className="mb-2 text-6xl">📄</div>
          <div className="text-sm text-neutral-gray4">Minimal Content</div>
        </div>
      </div>
    ),
  },
};

export const LongDescription = {
  args: {
    title: 'Article with Long Description',
    author: 'Content Writer',
    description:
      'This is a very long description that should be truncated after 200 characters to maintain a clean layout and prevent the component from becoming too tall. The description continues with more details about the content, including technical specifications, usage guidelines, and additional context that would normally be quite lengthy in a real-world scenario.',
    url: 'https://example.com/article',
    site: 'example.com',
    children: (
      <div className="flex aspect-video items-center justify-center rounded-t-lg bg-neutral-gray1">
        <div className="text-center">
          <div className="mb-2 text-6xl">📝</div>
          <div className="text-sm text-neutral-gray4">Long Description</div>
        </div>
      </div>
    ),
  },
};
