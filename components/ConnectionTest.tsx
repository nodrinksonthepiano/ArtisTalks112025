'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'

export default function ConnectionTest() {
  const [status, setStatus] = useState<'loading' | 'connected' | 'error'>('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    async function testConnection() {
      try {
        const supabase = createClient()
        // Try to select from profiles - even if empty, a successful query means connection works
        const { data, error } = await supabase.from('profiles').select('count').single()
        
        if (error && error.code !== 'PGRST116') { // PGRST116 is just "no rows returned" which is fine
          throw error
        }
        
        setStatus('connected')
        setMessage('Successfully connected to Supabase!')
      } catch (e: any) {
        setStatus('error')
        setMessage(e.message || 'Failed to connect')
        console.error('Supabase connection error:', e)
      }
    }

    testConnection()
  }, [])

  return (
    <div className="p-4 m-4 border rounded-lg bg-black/50 text-white max-w-md font-mono text-sm">
      <h3 className="font-bold mb-2">Supabase Connection Test</h3>
      <div className="flex items-center gap-2">
        <div className={`w-3 h-3 rounded-full ${
          status === 'connected' ? 'bg-green-500' : 
          status === 'error' ? 'bg-red-500' : 
          'bg-yellow-500 animate-pulse'
        }`} />
        <span>
          {status === 'loading' && 'Testing connection...'}
          {status === 'connected' && 'Connected ✅'}
          {status === 'error' && 'Connection Failed ❌'}
        </span>
      </div>
      {message && <p className="mt-2 text-gray-400 text-xs">{message}</p>}
    </div>
  )
}

