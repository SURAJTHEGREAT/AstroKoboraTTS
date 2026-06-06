import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import Chat from '../src/components/Chat';

describe('Chat Component', () => {
  it('renders chat interface correctly', async () => {
    render(
      <MemoryRouter>
        <Chat />
      </MemoryRouter>
    );

    // Verify initial state components
    expect(screen.getByText('Text-to-Speech Synthesis')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Type a prompt for streaming synthesis...')).toBeInTheDocument();

    // Verify default voice is selected
    const voiceSelect = screen.getByLabelText(/System & Blended:/i) as HTMLSelectElement;
    expect(voiceSelect).toBeInTheDocument();
    expect(voiceSelect.value).toBe('af_heart');

    // Verify other options exist
    expect(screen.getByText('Adam (Male)')).toBeInTheDocument();
    expect(screen.getByText('Emma (Female)')).toBeInTheDocument();

    // Wait for the async state updates from mount-time voice fetching to settle
    await waitFor(() => {
      expect(voiceSelect).toBeInTheDocument();
    });
  });
});
