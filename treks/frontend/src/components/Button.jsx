import { Link } from 'react-router-dom'

const variants = {
  primary: 'bg-brand text-brand-ink hover:bg-brand-hover',
  secondary: 'bg-white/8 text-ink border border-white/12 hover:bg-white/12',
  ghost: 'bg-transparent text-muted hover:text-ink hover:bg-white/5',
  outline: 'border border-white/15 text-ink hover:bg-white/5',
}

const sizes = {
  sm: 'px-3.5 py-2 text-xs',
  md: 'px-4 py-2.5 text-sm',
  lg: 'px-5 py-3 text-base',
}

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  to,
  href,
  className = '',
  type = 'button',
  ...props
}) {
  const classes = `inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:opacity-50 ${variants[variant]} ${sizes[size]} ${className}`

  if (to) {
    return (
      <Link to={to} className={classes} {...props}>
        {children}
      </Link>
    )
  }

  if (href) {
    return (
      <a href={href} className={classes} {...props}>
        {children}
      </a>
    )
  }

  return (
    <button type={type} className={classes} {...props}>
      {children}
    </button>
  )
}
