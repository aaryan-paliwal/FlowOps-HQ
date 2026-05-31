import { useState } from 'react';
import Icon from '../ui/Icon';
import { Card } from '../ui/Card';
import { useAuthStore } from '../state/authStore';
import { toast } from 'react-hot-toast';

export default function ContactPage() {
    const { user } = useAuthStore();
    const [formData, setFormData] = useState({
        name: user?.name || '',
        email: user?.email || '',
        subject: '',
        message: ''
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleChange = (e) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.name || !formData.email || !formData.subject || !formData.message) {
            toast.error("Please fill in all fields.");
            return;
        }

        setIsSubmitting(true);

        try {
            const response = await fetch("https://formsubmit.co/ajax/flowops.hq@gmail.com", {
                method: "POST",
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    _subject: `New Contact Request: ${formData.subject}`,
                    name: formData.name,
                    email: formData.email,
                    message: formData.message,
                    _template: "table"
                })
            });

            if (response.ok) {
                toast.success("Message sent securely in the background!");
                setFormData(prev => ({ ...prev, subject: '', message: '' }));
            } else {
                toast.error("Couldn't send the message at this time.");
            }
        } catch {
            toast.error("Network error. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="max-w-[1200px] mx-auto space-y-8 animate-in fade-in duration-200">
            {/* Standard Heading Block */}
            <div className="mb-8 font-sans">
                <div className="flex items-center gap-3 mb-1">
                    <Icon name="headphones" className="w-7 h-7 text-white/40" />
                    <h1 className="text-3xl font-bold tracking-tight text-white">
                        Contact Us
                    </h1>
                </div>
                <p className="text-[15px] text-neutral-450">
                    Need help with FlowOps HQ? Get in touch with our team of experts.
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Contact Form */}
                <Card className="p-8 lg:col-span-2 border border-white/5 bg-white/[0.02]">
                    <h2 className="text-lg font-bold text-white font-sans mb-6">Send us a message</h2>
                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div>
                                <label className="block text-[11px] font-bold text-neutral-400 font-sans tracking-wide uppercase mb-2">Your Name</label>
                                <div className="relative">
                                    <Icon name="person" className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-450" />
                                    <input
                                        type="text"
                                        name="name"
                                        value={formData.name}
                                        onChange={handleChange}
                                        placeholder="John Doe"
                                        className="w-full px-3 py-2.5 pl-9 bg-[#111111]/45 border border-white/5 rounded-lg text-[14px] font-sans text-white focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 transition-all"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold text-neutral-400 font-sans tracking-wide uppercase mb-2">Email Address</label>
                                <div className="relative">
                                    <Icon name="mail" className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-450" />
                                    <input
                                        type="email"
                                        name="email"
                                        value={formData.email}
                                        onChange={handleChange}
                                        placeholder="john@example.com"
                                        className="w-full px-3 py-2.5 pl-9 bg-[#111111]/45 border border-white/5 rounded-lg text-[14px] font-sans text-white focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 transition-all"
                                    />
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="block text-[11px] font-bold text-neutral-400 font-sans tracking-wide uppercase mb-2">Subject</label>
                            <div className="relative">
                                <Icon name="subject" className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-450" />
                                <input
                                    type="text"
                                    name="subject"
                                    value={formData.subject}
                                    onChange={handleChange}
                                    placeholder="How can we help you?"
                                    className="w-full px-3 py-2.5 pl-9 bg-[#111111]/45 border border-white/5 rounded-lg text-[14px] font-sans text-white focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 transition-all"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-[11px] font-bold text-neutral-400 font-sans tracking-wide uppercase mb-2">Message</label>
                            <textarea
                                name="message"
                                value={formData.message}
                                onChange={handleChange}
                                rows={6}
                                placeholder="Tell us more about your inquiry..."
                                className="w-full px-3 py-3 bg-[#111111]/45 border border-white/5 rounded-lg text-[14px] font-sans text-white focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 transition-all resize-none"
                            />
                        </div>

                        <div className="pt-4">
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="w-full sm:w-auto bg-[#06B6D4] hover:bg-[#08C1E0] text-neutral-950 px-8 py-3 rounded-xl font-sans font-bold text-[14px] transition-all shadow-[0_0_15px_rgba(6,182,212,0.15)] hover:shadow-[0_0_20px_rgba(6,182,212,0.3)] active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2 disabled:opacity-70"
                            >
                                {isSubmitting ? (
                                    <>
                                        <Icon name="autorenew" className="w-4.5 h-4.5 animate-spin" />
                                        Sending...
                                    </>
                                ) : (
                                    <>
                                        <Icon name="send" className="w-4.5 h-4.5" />
                                        Send Message
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </Card>

                {/* Side Information Panel */}
                <div className="space-y-6">
                    <Card className="p-6 border border-white/5 bg-white/[0.02]">
                        <h3 className="text-[15px] font-bold text-white font-sans mb-4">Contact Information</h3>
                        <div className="space-y-5">
                            <div className="flex items-start gap-4">
                                <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center shrink-0">
                                    <Icon name="mail" className="w-5 h-5 text-cyan-400" />
                                </div>
                                <div>
                                    <p className="text-[11px] font-bold text-neutral-500 uppercase tracking-wide font-sans mb-0.5">Email Support</p>
                                    <a href="mailto:flowops.hq@gmail.com" className="text-[14px] font-medium text-white hover:text-cyan-400 transition-colors">
                                        flowops.hq@gmail.com
                                    </a>
                                </div>
                            </div>

                            <div className="flex items-start gap-4">
                                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                                    <Icon name="location_on" className="w-5 h-5 text-emerald-400" />
                                </div>
                                <div>
                                    <p className="text-[11px] font-bold text-neutral-500 uppercase tracking-wide font-sans mb-0.5">Headquarters</p>
                                    <p className="text-[14px] font-medium text-neutral-300 leading-relaxed">
                                        Indore (452003), M.P.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </Card>

                    {/* Premium Call to Action */}
                    <div className="relative bg-gradient-to-br from-[#12141a] via-[#0a0a0a] to-[#0c0c0c] border border-white/5 rounded-2xl p-6 shadow-2xl overflow-hidden group">
                        <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                        <div className="relative z-10">
                            <h4 className="text-[14px] font-bold text-white font-sans mb-2 flex items-center gap-2">
                                <Icon name="rocket_launch" className="w-4 h-4 text-cyan-400" />
                                Enterprise Support
                            </h4>
                            <p className="text-[12px] text-neutral-400 font-sans leading-relaxed mb-4">
                                Need custom SLAs, dedicated account management, or deployment assistance?
                            </p>
                            <button className="w-full bg-white text-black hover:bg-neutral-200 px-4 py-2 rounded-lg font-sans font-bold text-[12px] transition-colors shadow-sm cursor-pointer">
                                Talk to Sales
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
