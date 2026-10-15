import { getApiErrorMessage } from './apiError';

const apiError = (detail) => ({ response: { status: 422, data: { detail } } });

test('turns FastAPI validation objects into readable field messages', () => {
  const error = apiError([
    { type: 'literal_error', loc: ['body', 'status'], msg: 'Input should be a valid status', input: { target: { value: 'resolved' } }, ctx: {} },
    { type: 'int_parsing', loc: ['path', 'voucher_id'], msg: 'Input should be a valid integer' },
  ]);
  expect(getApiErrorMessage(error)).toBe('status: Input should be a valid status; voucher_id: Input should be a valid integer');
});

test('preserves server messages and supports a single validation object', () => {
  expect(getApiErrorMessage(apiError('Voucher not found'))).toBe('Voucher not found');
  expect(getApiErrorMessage(apiError({ loc: ['body'], msg: 'Invalid request' }))).toBe('Invalid request');
});

test.each([undefined, null, '', [], {}, [{ msg: {} }]])('uses a safe fallback for unusable detail: %p', (detail) => {
  expect(getApiErrorMessage(apiError(detail), 'Failed to update ticket status')).toBe('Failed to update ticket status');
});

test('handles network failures without a response', () => {
  expect(getApiErrorMessage(new Error('Network Error'), 'Failed to load tickets')).toBe('Failed to load tickets');
});
