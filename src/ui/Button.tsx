import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'quiet' | 'danger';
type Size = 'md' | 'lg' | 'sm';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  block?: boolean;
}

export function Button({ variant = 'secondary', size = 'md', icon, block, className = '', children, type = 'button', ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      className={`btn btn--${variant} btn--${size}${block ? ' btn--block' : ''} ${className}`.trim()}
      {...rest}
    >
      {icon}
      {children != null && <span>{children}</span>}
    </button>
  );
}

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  children: ReactNode;
}

export function IconButton({ label, children, className = '', type = 'button', ...rest }: IconButtonProps) {
  return (
    <button type={type} aria-label={label} title={label} className={`icon-btn ${className}`.trim()} {...rest}>
      {children}
    </button>
  );
}
