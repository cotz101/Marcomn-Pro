'use client';

import { createContext, useContext } from 'react';

export const DialogContext = createContext({
  isOpen: false,
  onClose: () => {},
  disableBackdropClick: false,
  disableEscapeKey: false,
  titleId: undefined,
  setTitleId: () => {},
  descriptionId: undefined,
  setDescriptionId: () => {},
});

export function useDialogContext() {
  return useContext(DialogContext);
}
