import type { ComponentPropsWithoutRef } from 'react';
import type { IconType } from 'react-icons';

import { cn } from '../../utils/cn';

type BaseIconProps = Omit<ComponentPropsWithoutRef<'svg'>, 'children'>;

export type IconProps = BaseIconProps & {
  icon: IconType;
  size?: number;
};

export function Icon({ icon: IconComponent, className, size = 18, ...props }: IconProps) {
  return <IconComponent className={cn('shrink-0', className)} size={size} {...props} />;
}
