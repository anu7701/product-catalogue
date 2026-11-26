import type { EnquiryNotification } from './notifier.ts';

/**
 * Records an enquiry before it is sent (ARCHITECTURE §3.3, A34).
 * The PoC adapter does nothing; persistence is Next step #1 in DECISIONS.md.
 */
export interface EnquiryRecorder {
  record(enquiry: EnquiryNotification): Promise<void>;
}
