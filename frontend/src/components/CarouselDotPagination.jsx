/** Dot indicators below horizontal card carousels — brand cyan. */
export default function CarouselDotPagination({
    total,
    active,
    current,
    className = '',
}) {
    const index = current ?? active ?? 0;
    if (total <= 1) return null;

    const shown = Math.min(total, 5);

    return (
        <div
            className={`carousel-dots flex items-center justify-center gap-1.5 mt-3 ${className}`}
            aria-hidden
        >
            {Array.from({ length: shown }).map((_, i) => (
                <div
                    key={i}
                    className={`carousel-dot rounded-full transition-all duration-300 ${
                        i === index % shown ? 'carousel-dot--active' : 'carousel-dot--inactive'
                    }`}
                />
            ))}
        </div>
    );
}
