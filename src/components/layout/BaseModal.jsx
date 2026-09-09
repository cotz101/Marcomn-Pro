'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody } from '@/src/components/ui/dialog';

export default function BaseModal({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = '600px',
  disableBackdropClick = false,
  hideCloseButton = false,
}) {
  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      disableBackdropClick={disableBackdropClick}
    >
      <DialogContent maxWidth={maxWidth} className="modal-content-standard">
        {title !== undefined && title !== null && (
          <DialogHeader
            variant="navy"
            showCloseButton={!hideCloseButton}
            onClose={onClose}
            className="modal-header-navy"
          >
            {title ? <DialogTitle className="modal-title-white">{title}</DialogTitle> : null}
          </DialogHeader>
        )}
        <DialogBody className="modal-body-standard">
          {children}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
