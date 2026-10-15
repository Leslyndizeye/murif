import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import DropdownSelect from './dropdown-select';

// Keep this test focused on the value passed to callers, independent of portals.
jest.mock('./dropdown-menu', () => {
  const React = require('react');
  const Wrapper = ({ children }) => <div>{children}</div>;
  return {
    DropdownMenu: Wrapper,
    DropdownMenuTrigger: Wrapper,
    DropdownMenuContent: Wrapper,
    DropdownMenuItem: ({ children, onSelect }) => <button onClick={onSelect}>{children}</button>,
  };
});
jest.mock('./button', () => {
  const React = require('react');
  return { Button: ({ children }) => <button>{children}</button> };
});

test('passes a status string rather than an event object to onChange', () => {
  const onChange = jest.fn();
  render(<DropdownSelect value="open" onChange={onChange} options={[{ value: 'resolved', label: 'Resolved' }]} />);
  fireEvent.click(screen.getByRole('button', { name: 'Resolved' }));
  expect(onChange).toHaveBeenCalledWith('resolved');
});
