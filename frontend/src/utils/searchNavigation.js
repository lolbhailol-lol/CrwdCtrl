/**
 * Navigate to the correct page from a unified search result.
 */
export function navigateToSearchResult(navigate, result) {
  if (!result) return;
  const type = result.resultType || result._type;
  const id = result.id || result._id;

  if (type === 'competition') {
    navigate(`/competitions-view-details/${id}`);
    return;
  }
  if (type === 'fest') {
    navigate(`/view-details/${id}`);
    return;
  }
  if (type === 'trek') {
    navigate(`/trek/${id}`, {
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
    navigate(`/treks/community/${id}`, {
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
    navigate(`/sports/run-club/${id}`, {
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
    navigate(`/sports/run/${id}`);
    return;
  }
  if (id) {
    navigate(`/view-details/${id}`);
  }
}
