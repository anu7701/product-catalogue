import { setupServer } from 'msw/node';
import { handlers } from './handlers.ts';

/** Mock API for every web test; a request with no handler fails the test. */
export const server = setupServer(...handlers);
