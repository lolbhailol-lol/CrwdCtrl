/**
 * Trek-level groupLink takes priority over the linked community's groupLink.
 */
function resolveTrekGroupLink(trek) {
    if (!trek) return { groupLink: '', communityName: '' };

    const trekLink = String(trek.groupLink || '').trim();
    const community =
        trek.communityId && typeof trek.communityId === 'object' ? trek.communityId : null;
    const communityLink = String(community?.groupLink || '').trim();
    const groupLink = trekLink || communityLink;
    const communityName = trekLink
        ? String(trek.trekName || '').trim()
        : String(community?.name || trek.trekName || '').trim();

    return { groupLink, communityName };
}

module.exports = { resolveTrekGroupLink };
