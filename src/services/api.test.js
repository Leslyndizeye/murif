import axios from 'axios';
import { authAPI, usersAPI } from './api';

jest.mock('axios', () => ({ create: jest.fn(() => ({
  interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } },
  post: jest.fn(),
})) }));
const mockApi = axios.create.mock.results[0].value;
beforeEach(() => { jest.clearAllMocks(); localStorage.clear(); });

test('creates users using manual delivery and never persists the temporary password', async () => {
  const details = { email: 'new@icttoolsasm.com', temporary_password: 'Temporary-test-234' };
  mockApi.post.mockResolvedValue({ data: details });
  expect(await usersAPI.createUser({ email: details.email, role: 'USER' })).toEqual(details);
  expect(mockApi.post).toHaveBeenCalledWith('/users/create-user', { email: details.email, role: 'USER', delivery_method: 'manual' });
  expect(localStorage.length).toBe(0);
});

test('updates the session after changing a temporary password', async () => {
  const response = { access_token: 'new-token', user: { role: 'USER', must_change_password: false } };
  mockApi.post.mockResolvedValue({ data: response });
  const payload = { current_password: 'Temporary-test-234', new_password: 'Replacement-test-234' };
  await authAPI.changePassword(payload);
  expect(mockApi.post).toHaveBeenCalledWith('/auth/change-password', payload);
  expect(localStorage.getItem('access_token')).toBe('new-token');
  expect(JSON.parse(localStorage.getItem('user')).must_change_password).toBe(false);
  expect(JSON.stringify(localStorage)).not.toContain('Replacement-test-234');
});
