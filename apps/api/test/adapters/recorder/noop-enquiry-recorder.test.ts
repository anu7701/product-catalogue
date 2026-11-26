import { describe, expect, it } from 'vitest';
import { NoopEnquiryRecorder } from '../../../src/adapters/recorder/noop-enquiry-recorder.ts';

describe('NoopEnquiryRecorder (A34)', () => {
  it('accepts an enquiry and stores nothing', async () => {
    await expect(new NoopEnquiryRecorder().record()).resolves.toBeUndefined();
  });
});
