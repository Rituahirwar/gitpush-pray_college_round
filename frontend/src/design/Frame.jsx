import './Frame.css'

export default function Frame({
  microLabel,
  title,
  action,
  children,
  className = '',
  variant = 'default',
  as: Component = 'div',
  ...props
}) {
  return (
    <Component className={`blueprint-frame blueprint-frame--${variant} ${className}`} {...props}>
      <span className="corner-tick corner-tick--tl" aria-hidden="true" />
      <span className="corner-tick corner-tick--tr" aria-hidden="true" />
      <span className="corner-tick corner-tick--bl" aria-hidden="true" />
      <span className="corner-tick corner-tick--br" aria-hidden="true" />

      {(microLabel || title || action) && (
        <div className="blueprint-frame__header">
          <div className="blueprint-frame__header-left">
            {microLabel && <span className="mono-label frame-micro-label">{microLabel}</span>}
            {title && <h3 className="mono-title frame-title">{title}</h3>}
          </div>
          {action && <div className="blueprint-frame__header-action">{action}</div>}
        </div>
      )}

      <div className="blueprint-frame__content">
        {children}
      </div>
    </Component>
  )
}
