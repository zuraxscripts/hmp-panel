import React, { useState } from 'react';
import { Button, Modal } from '@heroui/react';
import { RotateCcw } from 'lucide-react';

interface RestartPromptProps {
  open: boolean;
  onClose: () => void;
  onRestart: () => void | Promise<void>;
  t: (k: string, f?: string) => string;
}

export function RestartPrompt({ open, onClose, onRestart, t }: RestartPromptProps) {
  const [restarting, setRestarting] = useState(false);

  async function handleRestart() {
    setRestarting(true);
    try {
      await onRestart();
    } finally {
      setRestarting(false);
      onClose();
    }
  }

  return (
    <Modal isOpen={open} onOpenChange={(o) => !o && !restarting && onClose()}>
      <Modal.Backdrop className="bg-black/80 backdrop-blur-sm">
        <Modal.Container size="sm">
          <Modal.Dialog className="bg-[#0a0a0a] border border-white/15 rounded-2xl text-white">
            <Modal.Header className="border-b border-white/10 px-5 py-4">
              <Modal.Heading className="text-sm font-bold text-white">
                {t('restart_required_title', 'Restart required')}
              </Modal.Heading>
            </Modal.Header>
            <Modal.Body className="p-5">
              <p className="text-xs text-zinc-400 leading-relaxed">
                {t(
                  'restart_required_desc',
                  'Changes were saved. The server must be restarted to apply them.'
                )}
              </p>
            </Modal.Body>
            <Modal.Footer className="border-t border-white/10 px-5 py-3 flex justify-end gap-2">
              <Button
                variant="secondary"
                onPress={onClose}
                isDisabled={restarting}
                className="rounded-xl"
              >
                {t('btn_later', 'Later')}
              </Button>
              <Button
                variant="primary"
                onPress={handleRestart}
                isDisabled={restarting}
                className="rounded-xl font-semibold"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${restarting ? 'animate-spin' : ''}`} />
                <span>{restarting ? t('btn_restarting', 'Restarting...') : t('btn_restart_now', 'Restart now')}</span>
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
