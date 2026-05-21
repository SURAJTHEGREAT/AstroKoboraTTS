import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import Chat from '../src/components/Chat';

describe('Chat Component', () => {
  it('renders chat interface correctly', () => {
    render(
      <MemoryRouter>
        <Chat />
      </MemoryRouter>
    );

    // Verify initial state components
    expect(screen.getByText('Text-to-Speech Synthesis')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Type a prompt for streaming synthesis...')).toBeInTheDocument();

    // Verify default voice is selected
    const voiceSelect = screen.getByLabelText(/Trained Voices:/i) as HTMLSelectElement;
    expect(voiceSelect).toBeInTheDocument();
    expect(voiceSelect.value).toBe('af_heart');

    // Verify other options exist
    expect(screen.getByText('Adam (Male)')).toBeInTheDocument();
    expect(screen.getByText('Emma (Female)')).toBeInTheDocument();
  });
});
