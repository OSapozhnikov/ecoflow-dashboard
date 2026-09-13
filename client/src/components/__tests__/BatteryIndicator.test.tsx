/**
 * Unit tests for BatteryIndicator component
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BatteryIndicator } from '../BatteryIndicator';

describe('BatteryIndicator', () => {
  it('should render battery level', () => {
    render(<BatteryIndicator level={85} />);

    expect(screen.getByText('85%')).toBeInTheDocument();
  });

  it('should show green color for high battery level', () => {
    const { container } = render(<BatteryIndicator level={85} />);
    
    const batteryFill = container.querySelector('.bg-green-500');
    expect(batteryFill).toBeInTheDocument();
  });

  it('should show yellow color for medium battery level', () => {
    const { container } = render(<BatteryIndicator level={30} />);
    
    const batteryFill = container.querySelector('.bg-yellow-500');
    expect(batteryFill).toBeInTheDocument();
  });

  it('should show red color for low battery level', () => {
    const { container } = render(<BatteryIndicator level={15} />);
    
    const batteryFill = container.querySelector('.bg-red-500');
    expect(batteryFill).toBeInTheDocument();
  });

  it('should handle 0% battery level', () => {
    render(<BatteryIndicator level={0} />);

    expect(screen.getByText('0%')).toBeInTheDocument();
  });

  it('should handle 100% battery level', () => {
    render(<BatteryIndicator level={100} />);

    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('should apply correct size classes for small size', () => {
    const { container } = render(<BatteryIndicator level={50} size="sm" />);
    
    const battery = container.querySelector('.w-16.h-8');
    expect(battery).toBeInTheDocument();
  });

  it('should apply correct size classes for medium size', () => {
    const { container } = render(<BatteryIndicator level={50} size="md" />);
    
    const battery = container.querySelector('.w-24.h-12');
    expect(battery).toBeInTheDocument();
  });

  it('should apply correct size classes for large size', () => {
    const { container } = render(<BatteryIndicator level={50} size="lg" />);
    
    const battery = container.querySelector('.w-32.h-16');
    expect(battery).toBeInTheDocument();
  });

  it('should use medium size as default', () => {
    const { container } = render(<BatteryIndicator level={50} />);
    
    const battery = container.querySelector('.w-24.h-12');
    expect(battery).toBeInTheDocument();
  });
});

