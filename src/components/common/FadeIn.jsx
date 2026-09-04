import { motion } from 'framer-motion';

/**
 * Wrap any page/section content to fade it in on mount.
 * Usage: <FadeIn><YourContent /></FadeIn>
 */
const FadeIn = ({ children, duration = 0.5, delay = 0, y = 12 }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration, delay, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
};

export default FadeIn;
