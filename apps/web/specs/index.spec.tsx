import React from 'react';
import { render } from '@testing-library/react';
import { Providers } from '../src/app/providers';

describe('Providers', () => {
  it('should render children', () => {
    const { getByText } = render(
      <Providers>
        <span>ok</span>
      </Providers>
    );
    expect(getByText('ok')).toBeTruthy();
  });
});
