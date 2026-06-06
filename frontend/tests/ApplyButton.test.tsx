import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import Chat from '../src/components/Chat';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock fetch for API calls
global.fetch = vi.fn();

describe('Chat Component - Apply Button', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as any).mockImplementation((url: string) => {
      if (url === '/api/voices') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([]),
        });
      }
      return Promise.resolve({
        ok: true,
        body: {
          getReader: () => ({
            read: vi.fn()
              .mockResolvedValueOnce({ value: new TextEncoder().encode('data: {"status": "text", "text": "Hello world"}\n\n'), done: false })
              .mockResolvedValueOnce({ value: undefined, done: true }),
          }),
        },
      });
    });
  });

  it('shows Apply button on assistant messages and toggles disabled state based on input', async () => {
    render(
      <MemoryRouter>
        <Chat />
      </MemoryRouter>
    );

    const input = screen.getByPlaceholderText('Type a prompt for streaming synthesis...');
    const sendButton = screen.getByRole('button', { name: '' }); // Send button has icon only

    // 1. Send a message to get an assistant response
    fireEvent.change(input, { target: { value: 'Hello' } });
    fireEvent.click(sendButton);

    // Wait for the message to appear
    const applyButton = await screen.findByText('APPLY');
    expect(applyButton).toBeInTheDocument();

    // 2. Button should be enabled when input is empty
    expect(input).toHaveValue('');
    expect(applyButton).not.toBeDisabled();

    // 3. Button should be disabled when input has text
    fireEvent.change(input, { target: { value: 'Typing something...' } });
    expect(applyButton).toBeDisabled();

    // 4. Button should be enabled again when input is cleared
    fireEvent.change(input, { target: { value: '' } });
    expect(applyButton).not.toBeDisabled();
  });
});
