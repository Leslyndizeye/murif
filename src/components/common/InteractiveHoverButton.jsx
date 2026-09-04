import { forwardRef } from 'react';
import { FaArrowRight } from 'react-icons/fa';

/**
 * Bordered button: on hover, the label slides out and an arrow+label slide in
 * while a colored circle expands to fill the button. Plain CSS version (no Tailwind
 * in this project) of the "interactive hover button" pattern.
 */
const InteractiveHoverButton = forwardRef(({ text = 'Button', className = '', ...props }, ref) => {
  return (
    <button
      ref={ref}
      type="button"
      className={`muri-hover-btn ${className}`}
      {...props}
    >
      <span className="muri-hover-btn-label">{text}</span>
      <span className="muri-hover-btn-label-hover">
        {text}
        <FaArrowRight />
      </span>
      <span className="muri-hover-btn-circle" />
    </button>
  );
});

InteractiveHoverButton.displayName = 'InteractiveHoverButton';

export default InteractiveHoverButton;
