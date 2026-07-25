import { Link } from 'react-router-dom'

const variants = {
  primary:
    'bg-forest-800 text-stone hover:bg-forest-700 dark:bg-trail dark:text-forest-950 dark:hover:bg-trail-dark',
  secondary:
    'bg-white text-forest-800 border border-forest-800/15 hover:border-forest-800/30 dark:bg-forest-900 dark:text-stone dark:border-white/10',
  ghost:
    'bg-transparent text-forest-800 hover:bg-forest-800/5 dark:text-stone dark:hover:bg-white/5',
  outline:
    'border border-forest-800/20 text-forest-800 hover:bg-forest-800 hover:text-stone dark:border-white/20 dark:text-stone dark:hover:bg-white dark:hover:text-forest-950',
}

const sizes = {
  sm: 'px-3.5 py-2 text-sm',
  md: 'px-5 py-2.5 text-sm',
  lg: 'px-6 py-3 text-base',
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
  const classes = `inline-flex items-center justify-center gap-2 rounded-full font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-forest-950 disabled:opacity-50 ${variants[variant]} ${sizes[size]} ${className}`

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
