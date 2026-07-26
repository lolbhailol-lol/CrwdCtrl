import { useState } from 'react'

export default function Gallery({ images = [], alt = 'Trek gallery' }) {
  const [active, setActive] = useState(0)
  if (!images.length) return null

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-2xl border border-white/10">
        <img
          src={images[active]}
          alt={`${alt} ${active + 1}`}
          className="aspect-[16/10] w-full object-cover"
        />
      </div>
      <div className="grid grid-cols-4 gap-2 sm:gap-3">
        {images.map((src, index) => (
          <button
            key={src + index}
            type="button"
            onClick={() => setActive(index)}
            className={`overflow-hidden rounded-xl border-2 transition ${
              active === index ? 'border-brand' : 'border-transparent opacity-80 hover:opacity-100'
            }`}
            aria-label={`View image ${index + 1}`}
          >
            <img src={src} alt="" className="aspect-square w-full object-cover" loading="lazy" />
          </button>
        ))}
      </div>
    </div>
  )
}
