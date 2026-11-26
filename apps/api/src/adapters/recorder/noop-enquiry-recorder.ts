import type { EnquiryRecorder } from '../../ports/enquiry-recorder.ts';

/**
 * Enquiries are not stored in the PoC (A34): the email is the record.
 * Persistence (Next step #1) replaces this adapter without touching the
 * enquiry flow.
 */
export class NoopEnquiryRecorder implements EnquiryRecorder {
  record(): Promise<void> {
    return Promise.resolve();
  }
}
