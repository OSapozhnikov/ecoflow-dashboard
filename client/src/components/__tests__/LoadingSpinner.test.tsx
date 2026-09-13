/**
 * Unit tests for LoadingSpinner component
 */

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { LoadingSpinner } from '../LoadingSpinner';

describe('LoadingSpinner', () => {
  it('should render spinner', () => {
    const { container } = render(<LoadingSpinner />);
    
    const spinner = container.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  it('should have correct spinner classes', () => {
    const { container } = render(<LoadingSpinner />);
    
    const spinner = container.querySelector('.rounded-full.h-12.w-12.border-b-2.border-blue-500');
    expect(spinner).toBeInTheDocument();
  });

  it('should be centered', () => {
    const { container } = render(<LoadingSpinner />);
    
    const wrapper = container.querySelector('.flex.items-center.justify-center');
    expect(wrapper).toBeInTheDocument();
  });
});

