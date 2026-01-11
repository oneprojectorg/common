import type { Meta } from '@storybook/react-vite';
import { useRef, useState } from 'react';

import { Button } from '../src/components/Button';
import {
  RichTextEditor,
  type RichTextEditorRef,
} from '../src/components/RichTextEditor/RichTextEditor';

const meta: Meta<typeof RichTextEditor> = {
  component: RichTextEditor,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;

export const Example = () => (
  <div className="p-4 w-[800px] border border-dotted">
    <RichTextEditor />
  </div>
);

export const WithInitialContent = () => {
  const initialContent = `
    <h1>Welcome to the Rich Text Editor</h1>
    <p>This editor supports <strong>bold</strong>, <em>italic</em>, and <u>underline</u> formatting.</p>
    <h2>Features</h2>
    <ul>
      <li>Multiple heading levels</li>
      <li>Lists (ordered and unordered)</li>
      <li>Links and images</li>
      <li>Blockquotes</li>
    </ul>
    <blockquote>
      <p>This is a blockquote with some sample text.</p>
    </blockquote>
    <p>You can also add <a href="https://example.com">links</a> to your content.</p>
  `;

  return (
    <div className="p-4 w-[800px] border border-dotted">
      <RichTextEditor content={initialContent} />
    </div>
  );
};

export const WithChangeHandlers = () => {
  const [content, setContent] = useState('');
  const [updateCount, setUpdateCount] = useState(0);

  return (
    <div className="gap-4 flex w-[800px] flex-col">
      <div className="p-4 border border-dotted">
        <RichTextEditor
          onUpdate={(html) => {
            setContent(html);
            setUpdateCount((prev) => prev + 1);
          }}
        />
      </div>
      <div className="p-4 rounded-md bg-neutral-gray4">
        <p className="mb-2 font-semibold">Update count: {updateCount}</p>
        <p className="mb-2 text-sm text-neutral-gray1">Current content:</p>
        <pre className="max-h-40 p-2 overflow-auto rounded bg-white text-xs">
          {content || '<empty>'}
        </pre>
      </div>
    </div>
  );
};

export const WithRefAPI = () => {
  const editorRef = useRef<RichTextEditorRef>(null);
  const [status, setStatus] = useState('');

  const handleGetHTML = () => {
    const html = editorRef.current?.getHTML();
    setStatus(`HTML: ${html?.substring(0, 100)}...`);
  };

  const handleSetContent = () => {
    editorRef.current?.setContent(
      '<h2>Content set via ref!</h2><p>This content was injected using the ref API.</p>',
    );
    setStatus('Content set successfully');
  };

  const handleClear = () => {
    editorRef.current?.clear();
    setStatus('Content cleared');
  };

  const handleFocus = () => {
    editorRef.current?.focus();
    setStatus('Editor focused');
  };

  const handleCheckEmpty = () => {
    const isEmpty = editorRef.current?.isEmpty();
    setStatus(`Editor is ${isEmpty ? 'empty' : 'not empty'}`);
  };

  return (
    <div className="gap-4 flex w-[800px] flex-col border border-dotted">
      <div className="p-4">
        <RichTextEditor ref={editorRef} />
      </div>
      <div className="gap-2 flex flex-wrap">
        <Button onPress={handleGetHTML}>Get HTML</Button>
        <Button onPress={handleSetContent}>Set Content</Button>
        <Button onPress={handleClear}>Clear</Button>
        <Button onPress={handleFocus}>Focus</Button>
        <Button onPress={handleCheckEmpty}>Check Empty</Button>
      </div>
      {status && (
        <div className="p-3 rounded-md bg-neutral-gray4 text-sm">
          <strong>Status:</strong> {status}
        </div>
      )}
    </div>
  );
};

export const WithCustomStyling = () => (
  <div className="p-4 w-[800px] border border-dotted">
    <RichTextEditor
      className="p-4 rounded-lg border-2 border-teal bg-white"
      editorClassName="min-h-64"
    />
  </div>
);
