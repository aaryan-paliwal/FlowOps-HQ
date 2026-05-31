import { useEffect, useRef } from 'react';

export default function GlobalCursorGlow() {
    const glowRef = useRef(null);

    useEffect(() => {
        const handleMouseMove = (e) => {
            if (glowRef.current) {
                // A very subtle global red glow that tracks the cursor everywhere
                glowRef.current.style.background = `radial-gradient(600px circle at ${e.clientX}px ${e.clientY}px, rgba(220, 38, 38, 0.07), transparent 40%)`;
            }
        };
        
        window.addEventListener('mousemove', handleMouseMove, { passive: true });
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, []);

    return (
        <div 
            ref={glowRef} 
            className="pointer-events-none fixed inset-0 z-[9999] transition-opacity duration-300 mix-blend-screen"
        />
    );
}
