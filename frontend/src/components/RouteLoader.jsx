/** Minimal top progress bar — no full-screen logo splash */
export default function RouteLoader() {
    return (
        <div
            className="pointer-events-none fixed inset-x-0 top-0 z-100001 h-[2px] overflow-hidden"
            role="status"
            aria-label="Loading"
        >
            <div className="route-progress-bar h-full bg-[#0ECCEE]" />
        </div>
    );
}
