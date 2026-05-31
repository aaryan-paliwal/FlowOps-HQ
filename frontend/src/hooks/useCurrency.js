import { useAuthStore } from '../state/authStore';

export function useCurrency() {
    const user = useAuthStore(state => state.user);
    const location = user?.location || 'US';

    // India = INR, everyone else = USD for now.
    const currencyCode = location === 'IN' ? 'INR' : 'USD';
    const currencySymbol = location === 'IN' ? '₹' : '$';

    const formatAmount = (usdAmount, maxDecimals = 2) => {
        // Exchange rate logic (rough mockup for MVP: 1 USD = ~83 INR)
        const rate = location === 'IN' ? 83.5 : 1;
        const amount = usdAmount * rate;
        
        return new Intl.NumberFormat(location === 'IN' ? 'en-IN' : 'en-US', {
            style: 'currency',
            currency: currencyCode,
            maximumFractionDigits: maxDecimals,
            minimumFractionDigits: amount % 1 === 0 ? 0 : maxDecimals
        }).format(amount);
    };

    return { currencyCode, currencySymbol, formatAmount, location };
}
