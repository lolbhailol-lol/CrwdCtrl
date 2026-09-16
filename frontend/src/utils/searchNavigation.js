import { communityPath, competitionPath, eventShowPath, festPath, runClubPath, sportRunPath, trekPath } from './slugRoutes.js';

/**
 * Navigate to the correct page from a unified search result.
 */
export function navigateToSearchResult(navigate, result) {
  if (!result) return;
  const type = result.resultType || result._type;
  const id = result.id || result._id;

  if (type === 'competition') {
    navigate(competitionPath({ ...result, _id: id, id, name: result.title, title: result.title }));
    return;
  }
  if (type === 'fest') {
    navigate(festPath({ ...result, _id: id, id, festName: result.title, title: result.title }));
    return;
  }
  if (type === 'trek') {
    navigate(trekPath({ ...result, _id: id, id, trekName: result.title, title: result.title }), {
      state: {
        trek: {
          ...result,
          trekName: result.title || result.trekName,
          images: result.image ? [result.image] : result.images || [],
        },
      },
    });
    return;
  }
  if (type === 'community') {
    navigate(communityPath({ ...result, _id: id, id, name: result.title, title: result.title }), {
      state: {
        community: {
          id,
          title: result.title || result.name,
          subtitle: result.subtitle || result.basedIn,
          image: result.image || result.coverImage,
          trekCategories: result.trekCategories || [],
        },
      },
    });
    return;
  }
  if (type === 'runclub') {
    navigate(runClubPath({ ...result, _id: id, id, name: result.title, title: result.title }), {
      state: {
        club: {
          _id: id,
          name: result.title || result.name,
          basedIn: result.basedIn || result.subtitle,
          coverImage: result.image || result.coverImage,
        },
      },
    });
    return;
  }
  if (type === 'sport') {
    navigate(sportRunPath({
      ...result,
      _id: id,
      id,
      title: result.title,
      slug: result.slug,
      previousSlugs: result.previousSlugs,
    }), {
      state: {
        event: {
          ...result,
          _id: id,
          title: result.title,
          slug: result.slug,
        },
      },
    });
    return;
  }
  if (type === 'events' || type === 'event') {
    navigate(eventShowPath({ ...result, _id: id, id, title: result.title }));
    return;
  }
  if (id) {
    navigate(`/view-details/${id}`);
  }
}
