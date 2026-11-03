function updatePortalNetworkBadge() {
    const badge = document.getElementById('portal-network-badge');
    if (!badge) return;
    
    if (navigator.onLine) {
        badge.className = 'px-3 py-1 rounded-full text-[11px] font-semibold flex items-center gap-1.5 bg-emerald-600/90 text-white border border-emerald-400/30 backdrop-blur-sm shadow-sm';
        badge.innerHTML = `<span class="w-2 h-2 rounded-full bg-emerald-200 animate-pulse"></span> Mode Online`;
    } else {
        badge.className = 'px-3 py-1 rounded-full text-[11px] font-semibold flex items-center gap-1.5 bg-amber-600/90 text-white border border-amber-400/30 backdrop-blur-sm shadow-sm';
        badge.innerHTML = `<span class="w-2 h-2 rounded-full bg-amber-200"></span> Mode Offline`;
    }
}

function navigateToSelectedModule() {
    const selectedOption = document.querySelector('input[name="module_choice"]:checked');
    if (selectedOption) {
        window.location.href = selectedOption.value;
    } else {
        alert("Silakan pilih salah satu modul terlebih dahulu!");
    }
}

window.addEventListener('online', updatePortalNetworkBadge);
window.addEventListener('offline', updatePortalNetworkBadge);
document.addEventListener('DOMContentLoaded', updatePortalNetworkBadge);

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then((reg) => console.log('SW Registered:', reg.scope))
            .catch((err) => console.error('SW Fail:', err));
    });
}
