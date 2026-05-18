"use client"

import { motion, AnimatePresence } from "framer-motion"
import { Check } from "lucide-react"

interface NumberChipsProps {
  options: number[]
  value: number
  onChange: (val: number) => void
  label?: string
}

export default function NumberChips({ options, value, onChange, label }: NumberChipsProps) {
  return (
    <div className="space-y-2">
      {label && (
        <p className="text-xs font-medium text-slate-400">{label}</p>
      )}
      <motion.div
        className="flex flex-wrap gap-2"
        layout
        transition={{ type: "spring", stiffness: 500, damping: 30, mass: 0.5 }}
      >
        {options.map((opt) => {
          const isSelected = value === opt
          return (
            <motion.button
              key={opt}
              type="button"
              onClick={() => onChange(opt)}
              layout
              initial={false}
              animate={{
                backgroundColor: isSelected ? "#172554" : "rgba(39, 39, 42, 0.5)",
              }}
              whileHover={{
                backgroundColor: isSelected ? "#172554" : "rgba(39, 39, 42, 0.8)",
              }}
              whileTap={{
                backgroundColor: isSelected ? "#1e3a8a" : "rgba(39, 39, 42, 0.9)",
              }}
              transition={{
                type: "spring",
                stiffness: 500,
                damping: 30,
                mass: 0.5,
                backgroundColor: { duration: 0.1 },
              }}
              className={`inline-flex items-center px-4 py-1.5 rounded-full text-sm font-medium
                whitespace-nowrap ring-1 ring-inset transition-colors
                ${isSelected
                  ? "text-blue-300 ring-blue-500/40"
                  : "text-zinc-400 ring-white/8 hover:text-slate-200"
                }`}
            >
              <motion.div
                className="relative flex items-center"
                animate={{
                  paddingRight: isSelected ? "1.4rem" : "0",
                }}
                transition={{
                  ease: [0.175, 0.885, 0.32, 1.275],
                  duration: 0.3,
                }}
              >
                <span>{opt} questions</span>
                <AnimatePresence>
                  {isSelected && (
                    <motion.span
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0, opacity: 0 }}
                      transition={{ type: "spring", stiffness: 500, damping: 30, mass: 0.5 }}
                      className="absolute right-0"
                    >
                      <div className="w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center">
                        <Check className="w-2.5 h-2.5 text-white" strokeWidth={2.5} />
                      </div>
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.div>
            </motion.button>
          )
        })}
      </motion.div>
    </div>
  )
}
