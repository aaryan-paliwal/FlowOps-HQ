import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import App from './App.jsx'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false, // Prevent aggressive refetching in prod
      retry: 1,
      staleTime: 5 * 60 * 1000, // Cache data for 5 minutes
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
        <Toaster 
          position="top-right" 
          toastOptions={{
            className: 'font-sans text-[13px] font-bold shadow-lg border border-neutral-200 rounded-lg',
            style: { background: '#fff', color: '#000' }
          }} 
        />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
)
