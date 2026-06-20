import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React, { useState } from 'react';
import { MemoryRouter } from 'react-router';
import Chat from '../src/components/Chat';

const ChatTestWrapper = () => {
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState("Hello world");
  return <Chat sessionId="test-session" messages={messages} setMessages={setMessages} input={input} setInput={setInput} />;
};

describe('Chat Component - Send Button Logic', () => {
  it('enables send button when source and target languages are the same', async () => {
    render(
      <MemoryRouter>
        <ChatTestWrapper />
      </MemoryRouter>
    );

    const sourceSelect = screen.getByTestId('source-lang') as HTMLSelectElement;
    const targetSelect = screen.getByTestId('target-lang') as HTMLSelectElement;
    const sendButton = screen.getByTestId('submit-button') as HTMLButtonElement;

    // Default is eng_Latn for both
    expect(sourceSelect.value).toBe('eng_Latn');
    expect(targetSelect.value).toBe('eng_Latn');

    // Button should be enabled (it was disabled before my change)
    expect(sendButton.disabled).toBe(false);
  });
});
