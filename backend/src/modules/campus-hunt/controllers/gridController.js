const {
  joinByAccessCode,
  getSessionByToken,
  submitLevelPath,
  failTimedOutLevel,
  useHint,
} = require('../services/grid/gridSessionService');
const { assertLaptopClient } = require('../grid/laptopOnly');

async function join(req, res, next) {
  try {
    assertLaptopClient(req);
    const { accessCode } = req.body || {};
    const view = await joinByAccessCode(accessCode);
    return res.json({ success: true, data: view });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ success: false, message: err.message, code: err.code });
    }
    return next(err);
  }
}

async function getSession(req, res, next) {
  try {
    assertLaptopClient(req);
    const view = await getSessionByToken(req.params.sessionToken);
    return res.json({ success: true, data: view });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ success: false, message: err.message, code: err.code });
    }
    return next(err);
  }
}

async function submitLevel(req, res, next) {
  try {
    assertLaptopClient(req);
    const { path } = req.body || {};
    const result = await submitLevelPath(req.params.sessionToken, path);
    if (!result.ok) {
      return res.status(400).json({
        success: false,
        message: result.message,
        data: result.view || result,
      });
    }
    return res.json({ success: true, data: result });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ success: false, message: err.message, code: err.code });
    }
    return next(err);
  }
}

async function timeoutLevel(req, res, next) {
  try {
    assertLaptopClient(req);
    const result = await failTimedOutLevel(req.params.sessionToken);
    return res.json({ success: true, data: result });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ success: false, message: err.message, code: err.code });
    }
    return next(err);
  }
}

async function hint(req, res, next) {
  try {
    assertLaptopClient(req);
    const { path } = req.body || {};
    const result = await useHint(req.params.sessionToken, path);
    return res.json({ success: true, data: result });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ success: false, message: err.message, code: err.code });
    }
    return next(err);
  }
}

module.exports = {
  join,
  getSession,
  submitLevel,
  timeoutLevel,
  hint,
};
