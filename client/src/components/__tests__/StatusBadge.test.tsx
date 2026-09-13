/**
 * Unit tests for StatusBadge component
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusBadge } from '../StatusBadge';

describe('StatusBadge', () => {
  it('should render charging status', () => {
    render(<StatusBadge status="charging" />);

    expect(screen.getByText('Charging')).toBeInTheDocument();
  });

  it('should render discharging status', () => {
    render(<StatusBadge status="discharging" />);

    expect(screen.getByText('Discharging')).toBeInTheDocument();
  });

  it('should render standby status', () => {
    render(<StatusBadge status="standby" />);

    expect(screen.getByText('Standby')).toBeInTheDocument();
  });

  it('should apply correct classes for charging status', () => {
    const { container } = render(<StatusBadge status="charging" />);
    
    const badge = container.querySelector('.bg-blue-100');
    expect(badge).toBeInTheDocument();
  });

  it('should apply correct classes for discharging status', () => {
    const { container } = render(<StatusBadge status="discharging" />);
    
    const badge = container.querySelector('.bg-orange-100');
    expect(badge).toBeInTheDocument();
  });

  it('should apply correct classes for standby status', () => {
    const { container } = render(<StatusBadge status="standby" />);
    
    const badge = container.querySelector('.bg-gray-100');
    expect(badge).toBeInTheDocument();
  });
});

