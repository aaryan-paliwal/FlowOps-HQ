export function Footer() {
    return (
        <footer className="border-t border-white/5 bg-[#0A0A0A] mt-12 py-8">
            <div className="max-w-[1400px] mx-auto px-8 flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-3">
                    <img 
                        src="/Logo only.png?v=2" 
                        alt="FlowOps HQ" 
                        className="h-[24px] w-auto object-contain"
                    />
                    <span className="text-[12px] font-bold text-neutral-400 font-sans">© 2026 FlowOps HQ Technologies Inc. All rights reserved.</span>
                </div>
                <div className="flex items-center gap-6 text-[12px] font-bold text-neutral-400 font-sans">
                    <a href="#" className="hover:text-white transition-colors">Documentation</a>
                    <a href="#" className="hover:text-white transition-colors">API Reference</a>
                    <a href="#" className="hover:text-white transition-colors flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> System Status
                    </a>
                    <a href="#" className="hover:text-white transition-colors">Support</a>
                </div>
            </div>
        </footer>
    );
}
