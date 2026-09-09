'use client';

import { useEffect, useId } from 'react';
import { useDialogContext } from './DialogContext';

export function DialogTitle({
  children,
  id: customId,
  className = '',
  as: Component = 'h2',
  ...props
}) {
  const generatedId = useId();
  const id = customId || `dialog-title-${generatedId}`;
  const { setTitleId } = useDialogContext();

  useEffect(() => {
    setTitleId(id);
  }, [id, setTitleId]);

  return (
    <Component
      id={id}
      className={`text-base sm:text-lg font-bold tracking-tight leading-snug ${className}`}
      {...props}
    >
      {children}
    </Component>
  );
}

export default DialogTitle;
