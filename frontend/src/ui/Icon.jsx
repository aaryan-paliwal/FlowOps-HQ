export default function Icon({ name, className = '', size, style, ...props }) {
    // Dynamically map tailwind w-* classes to font-size so it matches Lucide's exact sizing behavior
    let computedSize = size;
    if (!computedSize) {
        const wMatch = className.match(/\bw-(\d+(?:\.\d+)?|\[.*?\])\b/);
        if (wMatch) {
            const val = wMatch[1];
            if (val.startsWith('[')) {
                computedSize = val.slice(1, -1); // e.g. w-[18px] -> 18px
            } else {
                computedSize = `${parseFloat(val) / 4}rem`; // e.g. w-4 -> 1rem, w-5 -> 1.25rem
            }
        }
    }

    return (
        <span 
            className={`material-symbols-outlined flex items-center justify-center shrink-0 leading-none normal-case ${className}`} 
            style={{ 
                ...(computedSize ? { fontSize: computedSize } : { fontSize: 'inherit' }),
                ...style 
            }}
            {...props}
        >
            {name}
        </span>
    );
}
