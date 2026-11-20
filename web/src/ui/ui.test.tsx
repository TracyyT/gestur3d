import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Panel } from './Panel';
import { Select } from './Select';
import { Slider } from './Slider';
import { Toggle } from './Toggle';

describe('Toggle', () => {
  it('exposes switch semantics and reports changes', () => {
    const onChange = vi.fn();
    render(<Toggle label="Reduced motion" checked={false} onChange={onChange} />);
    const sw = screen.getByRole('switch', { name: 'Reduced motion' });
    expect(sw).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(sw);
    expect(onChange).toHaveBeenCalledWith(true);
  });
});

describe('Slider', () => {
  it('is labelled, shows a readout and emits numbers', () => {
    const onChange = vi.fn();
    render(<Slider label="Smoothing" value={0.5} onChange={onChange} />);
    const input = screen.getByLabelText('Smoothing');
    expect(screen.getByText('50%')).toBeInTheDocument();
    fireEvent.change(input, { target: { value: '0.75' } });
    expect(onChange).toHaveBeenCalledWith(0.75);
  });
});

describe('Select', () => {
  it('emits the selected option value', () => {
    const onChange = vi.fn();
    render(
      <Select
        label="Quality"
        value="auto"
        onChange={onChange}
        options={[
          { value: 'auto', label: 'Auto' },
          { value: 'high', label: 'High' },
        ]}
      />,
    );
    fireEvent.change(screen.getByLabelText('Quality'), { target: { value: 'high' } });
    expect(onChange).toHaveBeenCalledWith('high');
  });
});

describe('Panel', () => {
  it('collapses and expands its body', () => {
    render(
      <Panel title="Settings">
        <p>Body</p>
      </Panel>,
    );
    const header = screen.getByRole('button', { name: /settings/i });
    expect(header).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Body')).toBeInTheDocument();
    fireEvent.click(header);
    expect(header).toHaveAttribute('aria-expanded', 'false');
  });
});
