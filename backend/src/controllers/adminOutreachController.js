const OutreachDataset = require('../model/outreach_dataset_model');

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

exports.listDatasets = async (req, res) => {
  try {
    const rows = await OutreachDataset.find({})
      .select('key name description sourceUrl contactCount uniqueEmailCount createdAt updatedAt')
      .sort({ updatedAt: -1 })
      .lean();
    res.json({ success: true, datasets: rows });
  } catch (error) {
    console.error('[admin.outreach.listDatasets]', error);
    res.status(500).json({ success: false, message: 'Failed to list datasets' });
  }
};

exports.getDataset = async (req, res) => {
  try {
    const { idOrKey } = req.params;
    const q = /^[a-f\d]{24}$/i.test(idOrKey)
      ? { _id: idOrKey }
      : { key: String(idOrKey || '').trim().toLowerCase() };
    const dataset = await OutreachDataset.findOne(q).lean();
    if (!dataset) return res.status(404).json({ success: false, message: 'Dataset not found' });

    const search = String(req.query.search || '').trim();
    let contacts = dataset.contacts || [];
    if (search) {
      const re = new RegExp(escapeRegex(search), 'i');
      contacts = contacts.filter((c) =>
        re.test(c.name || '')
        || re.test(c.email || '')
        || re.test(c.phone || '')
        || re.test(c.competition || '')
        || re.test(c.college || '')
      );
    }

    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
    const start = (page - 1) * limit;
    const pageContacts = contacts.slice(start, start + limit);

    res.json({
      success: true,
      dataset: {
        ...dataset,
        contacts: pageContacts,
      },
      pagination: {
        page,
        limit,
        total: contacts.length,
        pages: Math.ceil(contacts.length / limit) || 1,
      },
    });
  } catch (error) {
    console.error('[admin.outreach.getDataset]', error);
    res.status(500).json({ success: false, message: 'Failed to load dataset' });
  }
};
