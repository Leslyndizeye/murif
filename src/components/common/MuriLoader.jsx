import { motion } from 'framer-motion';

const WORD = 'MURI';

const letterVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: (i) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.08,
      duration: 0.5,
      ease: [0.16, 1, 0.3, 1],
    },
  }),
};

/**
 * Branded loading screen. Drop in wherever a page/dashboard needs a loading state
 * (e.g. `if (loading) return <MuriLoader label="Loading dashboard..." />`).
 */
const MuriLoader = ({ label = 'Loading...' }) => {
  return (
    <div className="muri-loader">
      <div className="muri-loader-word" aria-label={WORD}>
        {WORD.split('').map((letter, i) => (
          <motion.span
            key={`${letter}-${i}`}
            custom={i}
            initial="hidden"
            animate="visible"
            variants={letterVariants}
            className="muri-loader-letter"
          >
            {letter}
          </motion.span>
        ))}
      </div>
      <div className="muri-loader-ring" />
      {label && <p className="muri-loader-label">{label}</p>}
    </div>
  );
};

export default MuriLoader;
