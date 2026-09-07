import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CreatePlanStep1 } from './CreatePlanStep1';
import { LanguageProvider } from '../../contexts/LanguageContext';

function renderStep1() {
  return render(
    <LanguageProvider>
      <CreatePlanStep1 onContinue={vi.fn()} onCancel={vi.fn()} />
    </LanguageProvider>
  );
}

// No test coverage previously existed for this component -- these tests are
// scoped to the plan-name length/word limit added alongside the day-nickname
// limit, not an attempt to backfill full coverage for the whole step.
describe('CreatePlanStep1 plan name limits', () => {
  it('blocks typing a 9th word into the plan name input (max 8 words)', async () => {
    const user = userEvent.setup();
    renderStep1();

    const input = screen.getByLabelText(/plan name/i);
    await user.type(input, 'one two three four five six seven eight nine');

    expect(input).toHaveValue('one two three four five six seven eight ');
  });

  it('caps the plan name input at 60 characters', () => {
    renderStep1();

    expect(screen.getByLabelText(/plan name/i)).toHaveAttribute('maxLength', '60');
  });
});
