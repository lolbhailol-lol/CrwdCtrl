/** Copy for run clubs vs event communities (e.g. Delulu Athletes). */

export function isEventsListingHub(source) {
    if (!source) return false;
    if (typeof source === 'string') return source === 'events';
    return (
        source.listingHub === 'events'
        || source.runClub?.listingHub === 'events'
        || source.club?.listingHub === 'events'
        || source.runClubId?.listingHub === 'events'
    );
}

export function runClubIdOf(entity) {
    const rc = entity?.runClubId;
    if (!rc) return '';
    if (typeof rc === 'object') return String(rc._id || rc.id || '');
    return String(rc);
}

export function eventCommunityIdSet(clubs = []) {
    return new Set(
        (clubs || [])
            .filter((c) => c?.listingHub === 'events')
            .map((c) => String(c._id || c.id)),
    );
}

export function isEventHubSportsEvent(event, eventClubIds) {
    if (!event) return false;
    if (isEventsListingHub(event)) return true;
    const id = runClubIdOf(event);
    return Boolean(id && eventClubIds?.has(String(id)));
}

/** QR ticket URL query for sports category registrations (run club vs event community). */
export function sportsQrTicketQuery(isEventHub) {
    return isEventHub ? 'type=sports&hub=events' : 'type=sports';
}

export function sportsQrTicketPath(registrationId, isEventHub) {
    if (!registrationId) return '/booking';
    return `/qr-ticket/${registrationId}?${sportsQrTicketQuery(isEventHub)}`;
}

export function organizerHubCopy(isEventHub) {
    if (isEventHub) {
        return {
            portalName: 'Event organizer',
            loadingCommunity: 'Loading community',
            loadingDashboard: 'Loading event dashboard',
            loadingEvent: 'Loading event',
            dashboardBadge: 'Event dashboard',
            shareTitle: 'Share with guests',
            shareHint: 'Copy the public event page or open it in a new tab.',
            checkinHint: 'Live gate status for this event',
            bookingOpen: 'People can book this event right now.',
            bookingClosed: 'Booking is paused for new registrations.',
            payQr: 'Guests pay via UPI — you review screenshots.',
            payOnline: 'Guests pay online — bookings confirm automatically.',
            paymentMethodTitle: 'Payments',
            paymentCashfreeHint: 'Guests pay online. Bookings confirm automatically.',
            paymentManualHint: 'Guests pay via your QR and upload a screenshot. You approve each booking.',
            paymentManualToggle: 'Manual UPI + QR',
            paymentManualNeedsQr: 'Upload a payment QR first.',
            allEvents: 'All events',
            yourEvents: 'Your events',
            eventsCount: (n) => `${n} event${n === 1 ? '' : 's'} to manage`,
            noEvents: 'No events assigned yet. Ask CrwdCtrl admin to publish an event for your community.',
            homeHint: 'Track registrations, check in guests, and notify your community. Payments use Cashfree by default — turn on manual UPI + QR in the event dashboard if you need it.',
            communityEmptyTitle: 'Your community',
            communityEmpty: 'No community linked yet. Contact CrwdCtrl admin.',
            welcome: 'Welcome to your event organizer portal.',
            navAria: 'Event tools',
            registrations: 'Event registrations',
            notifyGuest: 'Send to this guest',
            searchPeople: 'Search confirmed guests…',
            messageOne: 'Message one guest',
            messageEveryone: 'Message everyone or one guest — in-app, push, and email.',
            guestMessage: 'Your message to this guest…',
            eventDate: 'Event date',
            guestNote: 'Add or edit the note the guest will see',
            scanName: 'Event check-in',
            approvedToast: 'Payment approved — guest notified',
            rejectedToast: 'Payment rejected — guest notified',
            publishLive: 'Event published — live on the website',
            draftSaved: 'Draft saved — click Publish event to show it on the website',
            loadingEditor: 'Loading editor',
            categoryLabel: 'Event category',
            whatGuests: 'What guests should know…',
            detailBoxesEmpty: 'No detail boxes yet. Start with Time, Game, or Café.',
            clubHome: 'Community home',
            portalSubtitle: 'Event organizer portal',
            createTitle: 'Create event',
            editTitle: 'Edit event',
            publishBtn: 'Publish event',
            publicPageHint: 'Add multiple phones and Instagram handles for the public event page.',
            detailBoxesHint: 'Game and Café times show beside the map. Other cards and How the evening works stay in Details. Drinks and perks go in Experience included.',
            whatsappPayment: (name) => `Hi${name ? ` ${name}` : ''}, this is about your event registration payment on CrwdCtrl.`,
            csvFallback: 'event',
            removeNamed: (name) => `Remove ${name} from this event? This cannot be undone.`,
            removeAnon: 'Remove this participant from the event? This cannot be undone.',
            activitySingular: 'event',
            activityPlural: 'events',
            loadFail: "Couldn't load this event",
            gone: 'This event is no longer available',
            browse: 'Browse events',
            browsePath: '/events',
            fallbackDesc: (title, community) =>
                `${title || 'This event'} is hosted by ${community}. Join the community for a great session.`,
            defaultTerms: [
                'Follow all safety instructions from organizers at all times.',
                'Cancellation policy varies by organiser — contact the community for details.',
                'The organiser reserves the right to modify or cancel due to weather or safety.',
            ],
            seoFallback: 'Event',
            titleFallback: 'Event',
            levelLabel: 'Level',
            styleLabel: 'Style',
            infoTitle: 'Event Info',
            bookLogin: 'Please log in to book this event.',
            bookingGoneHint: 'Open booking from the event page, or the link may be outdated.',
            closed: 'Registration is closed for this event',
            full: 'This event is full',
            backTo: 'Back to event',
            clubSeo: (name) => `${name} — Community`,
            listName: (name) => `Events by ${name}`,
            noCategories: 'No categories set yet.',
            joinCta: 'Join Community',
            distanceLabel: 'Duration',
            distancePlaceholder: 'e.g. 2 hours',
            formatLabel: 'Format',
            mapTitle: 'event-location',
            publicMapHint: 'Shown on the public event page map. Place name goes in Venue; paste a Maps link here for an exact pin.',
            feeLabel: 'Entry fee',
            checkoutApprover: 'community',
            goneHint: 'This community may have been removed or the link is outdated.',
            managerTitle: 'Community organizer',
            managerSubtitle: 'Your community dashboard — guests & check-ins',
            signupTitle: 'Create community organizer account',
            signupHint: 'Invite-only — sign in right after you create your account',
            signupEmailHint: 'Use the same email CrwdCtrl invited you with. You can sign in immediately after signup.',
            signupClubLabel: 'Event community',
            signupClubEmpty: 'No published communities yet. Ask CrwdCtrl to publish your community first.',
        signupLoginPath: '/event-community-organizer/login',
        signupPath: '/event-community-organizer/signup',
        };
    }
    return {
        portalName: 'Run Club Organizer',
        loadingCommunity: 'Loading run club',
        loadingDashboard: 'Loading run dashboard',
        loadingEvent: 'Loading run',
        dashboardBadge: 'Run dashboard',
        shareTitle: 'Share with runners',
        shareHint: 'Copy the public run page or open it in a new tab.',
        checkinHint: 'Live gate status for this run',
        bookingOpen: 'People can book this run right now.',
        bookingClosed: 'Booking is paused for new registrations.',
        payQr: 'Runners pay via UPI — you review screenshots.',
        payOnline: 'Runners pay online — bookings confirm automatically.',
        allEvents: 'All runs',
        yourEvents: 'Your runs',
        eventsCount: (n) => `${n} run${n === 1 ? '' : 's'} to manage`,
        noEvents: 'No runs assigned yet. Ask CrwdCtrl admin to publish a run for your club.',
        homeHint: 'Track registrations, approve payments when needed, check in runners, and notify your club. Run pricing is set by CrwdCtrl admin.',
        communityEmptyTitle: 'Your run club',
        communityEmpty: 'No run club linked yet. Contact CrwdCtrl admin.',
        welcome: 'Welcome to your run club organizer portal.',
        navAria: 'Run tools',
        registrations: 'Run registrations',
        notifyGuest: 'Send to this runner',
        searchPeople: 'Search confirmed runners…',
        messageOne: 'Message one runner',
        messageEveryone: 'Message everyone or one runner — in-app, push, and email.',
        guestMessage: 'Your message to this runner…',
        eventDate: 'Run date',
        guestNote: 'Add or edit the note the runner will see',
        scanName: 'Run check-in',
        approvedToast: 'Payment approved — runner notified',
        rejectedToast: 'Payment rejected — runner notified',
        publishLive: 'Run published — live on the website',
        draftSaved: 'Draft saved — click Publish run to show it on the website',
        loadingEditor: 'Loading editor',
        categoryLabel: 'Run category',
        whatGuests: 'What runners should know…',
        detailBoxesEmpty: 'No detail boxes yet. Start with Run Timing or Meeting Point.',
        clubHome: 'Club home',
        portalSubtitle: 'Run organizer portal',
        createTitle: 'Create run',
        editTitle: 'Edit run',
        publishBtn: 'Publish run',
        publicPageHint: 'Add multiple phones and Instagram handles for the public run page.',
        detailBoxesHint: 'Add cards one by one (timing, meeting point, fitness…) — shown on the public run page Details tab.',
        whatsappPayment: (name) => `Hi${name ? ` ${name}` : ''}, this is about your run registration payment on CrwdCtrl.`,
        csvFallback: 'run',
        removeNamed: (name) => `Remove ${name} from this run? This cannot be undone.`,
        removeAnon: 'Remove this participant from the run? This cannot be undone.',
        activitySingular: 'run',
        activityPlural: 'runs',
        loadFail: "Couldn't load this run",
        gone: 'This run is no longer available',
        browse: 'Browse sports',
        browsePath: '/sports',
        fallbackDesc: (title, community) =>
            `${title || 'This run'} is hosted by ${community}. Join fellow runners for a great session.`,
        defaultTerms: [
            'Participants must be medically fit for the scheduled run distance.',
            'Follow all safety instructions from run leaders at all times.',
            'Cancellation policy varies by organiser — contact the club for details.',
            'The organiser reserves the right to modify or cancel due to weather or safety.',
        ],
        seoFallback: 'Run Event',
        titleFallback: 'Run Name',
        levelLabel: 'Run Level',
        styleLabel: 'Run Style',
        infoTitle: 'Run Info',
        bookLogin: 'Please log in to book this run.',
        bookingGoneHint: 'Open booking from the run page, or the link may be outdated.',
        closed: 'Registration is closed for this run',
        full: 'This run is full',
        backTo: 'Back to run',
        clubSeo: (name) => `${name} — Running Club`,
        listName: (name) => `Runs by ${name}`,
            noCategories: 'No run categories set yet.',
            joinCta: 'Join Run Club',
            distanceLabel: 'Distance',
            distancePlaceholder: '5K',
            formatLabel: 'Style',
            mapTitle: 'run-location',
            publicMapHint: 'Shown on the public run page map. Place name goes in Venue; paste a Maps link here for an exact pin.',
            feeLabel: 'Run fee',
            checkoutApprover: 'club',
            goneHint: 'This club may have been removed or the link is outdated.',
            managerTitle: 'Club manager',
            managerSubtitle: 'Your club dashboard — participants & check-ins',
            signupTitle: 'Create club manager account',
            signupHint: 'Invite-only — then CrwdCtrl approves login',
            signupEmailHint: 'Use the same email CrwdCtrl added under Profile emails. After signup, wait for account approval before signing in.',
            signupClubLabel: 'Run club',
            signupClubEmpty: 'No published clubs yet. Ask CrwdCtrl to publish your club first.',
            signupLoginPath: '/run-club-organizer/login',
            signupPath: '/run-club-organizer/signup',
        };
    }

export function organizerBroadcastPresets(isEventHub) {
    if (isEventHub) {
        return [
            { title: 'Reporting time updated', message: 'The reporting time for the event has been updated. Please check the event page for the latest schedule.' },
            { title: 'Meeting point changed', message: 'The meeting point has changed. Please see the updated location on the event page before you travel.' },
            { title: 'Event cancelled', message: 'We regret to inform you that this event has been cancelled. Refund details will be shared shortly.' },
        ];
    }
    return [
        { title: 'Reporting time updated', message: 'The reporting time for the run has been updated. Please check the run page for the latest schedule.' },
        { title: 'Meeting point changed', message: 'The meeting point has changed. Please see the updated location on the run details page before you travel.' },
        { title: 'Run cancelled', message: 'We regret to inform you that this run has been cancelled. Refund details will be shared shortly.' },
    ];
}

export function organizerIndividualPresets(isEventHub) {
    if (isEventHub) {
        return [
            { title: 'Payment received', message: 'We received your payment — see you at the event!' },
            { title: 'Please arrive early', message: 'Please arrive 10 minutes early for check-in.' },
            { title: 'Quick check-in', message: 'Bring your QR ticket ready for a faster check-in.' },
        ];
    }
    return [
        { title: 'Payment received', message: 'We received your payment — see you at the run!' },
        { title: 'Please arrive early', message: 'Please arrive 10 minutes early for check-in and warm-up.' },
        { title: 'Quick check-in', message: 'Bring your QR ticket ready for a faster check-in.' },
    ];
}
