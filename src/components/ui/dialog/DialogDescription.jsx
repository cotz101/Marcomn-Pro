'use client';

import { useEffect, useId } from 'react';
import { useDialogContext } from './DialogContext';

export function DialogDescription({
  children,
  id: customId,
  className = '',
  as: Component = 'p',
  ...props
}) {
  const generatedId = useId();
  const id = customId || `dialog-desc-${generatedId}`;
  const { setDescriptionId } = useDialogContext();

  useEffect(() => {
    setDescriptionId(id);
    return () => {
      setDescriptionId(undefined);
    };
  }, [id, setDescriptionId]);

  return (
    <Component
      id={id}
      className={`text-xs sm:text-sm leading-relaxed ${className}`}
      {...props}
    >
      {children}
    </Component>
  );
}

export default DialogDescription;
