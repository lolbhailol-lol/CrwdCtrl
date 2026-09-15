function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function delay(ms) {
  return new Promise((resolve) => { setTimeout(resolve, ms); });
}

/**
 * Download combined export (one file) plus optional per-team JSON files.
 * @param {object} exportData — API response `data` from adminExportOfflinePacks
 * @param {{ perTeam?: boolean }} options
 */
export async function downloadOfflinePacks(exportData, options = {}) {
  const slug = exportData?.event?.slug || 'campus-hunt';
  const stamp = (exportData?.exportedAt || new Date().toISOString()).slice(0, 10);
  const combinedName = `${slug}-offline-packs-${stamp}.json`;

  downloadJson(combinedName, exportData);

  if (options.perTeam && Array.isArray(exportData?.bundles) && exportData.bundles.length) {
    await delay(400);
    for (const entry of exportData.bundles) {
      downloadJson(entry.filename || `${entry.teamCode}.offline.bundle.json`, entry.bundle);
      await delay(350);
    }
  }
}
