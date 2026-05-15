'use client';

import { useState, useEffect, useRef } from 'react';
import 'react-quill/dist/quill.snow.css';

const RichTextEditor = ({ value, onChange, placeholder, className = "" }) => {
  const containerRef = useRef(null);
  const quillRef = useRef(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && containerRef.current && !quillRef.current) {
      const initQuill = async () => {
        const Quill = (await import('quill')).default;
        quillRef.current = new Quill(containerRef.current, {
          theme: 'snow',
          placeholder: placeholder || 'Type here...',
          modules: {
            toolbar: [
              ['bold', 'italic'],
              [{ 'list': 'ordered' }, { 'list': 'bullet' }],
              ['clean']
            ],
          },
        });

        quillRef.current.on('text-change', () => {
          const html = quillRef.current.root.innerHTML;
          if (html === '<p><br></p>') {
            onChange('');
          } else {
            onChange(html);
          }
        });

        if (value) {
          quillRef.current.root.innerHTML = value;
        }
      };
      initQuill();
    }
  }, [mounted, placeholder]); // Added placeholder to deps

  useEffect(() => {
    if (quillRef.current && value !== quillRef.current.root.innerHTML) {
      if (value === '' && quillRef.current.root.innerHTML === '<p><br></p>') return;
      quillRef.current.root.innerHTML = value || '';
    }
  }, [value]);

  return (
    <div className={`rich-text-editor-container ${className}`}>
      <div ref={containerRef} />
    </div>
  );
};

export default RichTextEditor;
