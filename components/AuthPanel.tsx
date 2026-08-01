'use client'

import { motion } from 'framer-motion'
import OtpEmailFlow from '@/components/OtpEmailFlow'

export default function AuthPanel() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto rounded-lg overflow-hidden"
      style={{
        backgroundImage: 'url(/IMG_723E215270D1-1.jpeg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        padding: '20px',
        boxShadow: '0 0 10px rgba(255, 215, 0, 0.8)',
        maxWidth: '450px',
        width: '90%',
        textAlign: 'center',
        color: 'white',
        margin: '20px',
      }}
    >
      <div>
        <h1 className="gold-etched" style={{ marginTop: '0', marginBottom: '20px' }}>
          Welcome, My Champion...
        </h1>
        <OtpEmailFlow emailPlaceholder="Enter Artist Name or Email" sendButtonLabel="Send" />
      </div>
    </motion.div>
  )
}
