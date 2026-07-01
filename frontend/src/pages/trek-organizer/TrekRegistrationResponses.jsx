function FieldValue({ field }) {
    if (field.isFile && field.fileUrl) {
        return (
            <a href={field.fileUrl} target="_blank" rel="noopener noreferrer" className="text-[#0ECCEE] hover:underline break-all">
                View file
            </a>
        );
    }
    if (field.isFile) {
        return <span className="text-emerald-400">File uploaded</span>;
    }
    return <span className="break-words">{field.value || '—'}</span>;
}

export default function TrekRegistrationResponses({ fields = [], bookingDetails = null, userEmail = '' }) {
    const hasBookingMeta = bookingDetails && (bookingDetails.date || bookingDetails.time || bookingDetails.people > 1);

    if (!fields.length && !hasBookingMeta && !userEmail) {
        return (
            <p className="text-sm text-gray-500">No registration form data recorded.</p>
        );
    }

    return (
        <div className="space-y-4">
            {hasBookingMeta ? (
                <div className="grid grid-cols-2 gap-3 text-sm">
                    {bookingDetails.date ? (
                        <div>
                            <p className="text-[11px] text-gray-500 uppercase">Selected date</p>
                            <p>{bookingDetails.date}</p>
                        </div>
                    ) : null}
                    {bookingDetails.time ? (
                        <div>
                            <p className="text-[11px] text-gray-500 uppercase">Selected time</p>
                            <p>{bookingDetails.time}</p>
                        </div>
                    ) : null}
                    {bookingDetails.people ? (
                        <div>
                            <p className="text-[11px] text-gray-500 uppercase">People</p>
                            <p>{bookingDetails.people}</p>
                        </div>
                    ) : null}
                </div>
            ) : null}

            {userEmail && !fields.some((f) => /email/i.test(f.fieldName) || /email/i.test(f.label)) ? (
                <div className="text-sm">
                    <p className="text-[11px] text-gray-500 uppercase">Email</p>
                    <p className="break-all">{userEmail}</p>
                </div>
            ) : null}

            {fields.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    {fields.map((field) => (
                        <div key={field.fieldName} className={field.type === 'textarea' ? 'sm:col-span-2' : ''}>
                            <p className="text-[11px] text-gray-500 uppercase">{field.label}</p>
                            <div className="text-gray-200 mt-0.5">
                                <FieldValue field={field} />
                            </div>
                        </div>
                    ))}
                </div>
            ) : null}
        </div>
    );
}
