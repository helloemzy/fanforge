const express = require('express');
const {
  createWork,
  updateWork,
  findWorkById,
} = require('../db/workRepository');
const {
  listCommentsByWork,
  insertComment,
  insertKudos,
  hasKudos,
  upsertBookmark,
  findBookmark,
  upsertReadingProgress,
  findReadingProgress,
} = require('../db/interactionRepository');
const {
  parseOrThrow,
  workSchema,
  commentSchema,
  bookmarkSchema,
  readingProgressSchema,
} = require('../utils/validators');
const {
  generateUniqueSlug,
  countWords,
  normalizeTags,
} = require('../services/workService');
const {
  coverUpload,
  uploadCoverImage,
  removeCoverIfPresent,
} = require('../services/uploadService');
const { verifyCsrf } = require('../middleware/csrfProtection');
const {
  requireVerifiedEmail,
} = require('../middleware/authentication');
const {
  createLimiter,
  uploadLimiter,
  readLimiter,
  fullReadLimiter,
} = require('../middleware/rateLimits');
const { hasValidReaderPass } = require('../middleware/readerShield');
const {
  textToParagraphs,
  textToParagraphsWithWatermark,
  previewTextByWords,
} = require('../utils/textFormatting');

const router = express.Router();

const toNumericId = (value) => Number.parseInt(value, 10);

const emptyWorkForm = {
  title: '',
  summary: '',
  content: '',
  fandom: '',
  rating: 'Teen',
  status: 'WIP',
  tags: '',
};

const renderWorkNotFound = (res) => {
  return res.status(404).render('error', {
    statusCode: 404,
    message: 'Work not found.',
  });
};

const renderOwnershipError = (res) => {
  return res.status(403).render('error', {
    statusCode: 403,
    message: 'You can only edit your own work.',
  });
};

const toEditorErrorMessage = (error, fallbackMessage) => {
  if (error?.message?.includes('Object storage is required in this environment')) {
    return 'Cover uploads are temporarily unavailable. You can still publish without a cover image.';
  }

  return error?.message || fallbackMessage;
};

router.get('/new', requireVerifiedEmail, (req, res) => {
  res.render('work-editor', {
    mode: 'create',
    work: null,
    values: emptyWorkForm,
    error: null,
  });
});

router.post(
  '/new',
  requireVerifiedEmail,
  uploadLimiter,
  coverUpload.single('coverImage'),
  verifyCsrf,
  createLimiter,
  async (req, res) => {
    let uploadedCover = null;

    try {
      const form = parseOrThrow(workSchema, req.body);
      const tags = normalizeTags(form.tags || '');
      const slug = await generateUniqueSlug(form.title);
      const wordCount = countWords(form.content);

      if (req.file) {
        uploadedCover = await uploadCoverImage({
          file: req.file,
          userId: req.user.id,
        });
      }

      const workId = await createWork({
        authorId: req.user.id,
        slug,
        title: form.title,
        summary: form.summary,
        content: form.content,
        fandom: form.fandom,
        rating: form.rating,
        status: form.status,
        wordCount,
        coverPath: uploadedCover?.coverPath || null,
        coverStorageKey: uploadedCover?.coverStorageKey || null,
        tags,
      });

      return res.redirect(`/works/${workId}`);
    } catch (error) {
      if (uploadedCover?.coverStorageKey) {
        await removeCoverIfPresent(uploadedCover.coverStorageKey);
      }

      return res.status(400).render('work-editor', {
        mode: 'create',
        work: null,
        values: {
          title: req.body.title || '',
          summary: req.body.summary || '',
          content: req.body.content || '',
          fandom: req.body.fandom || '',
          rating: req.body.rating || 'Teen',
          status: req.body.status || 'WIP',
          tags: req.body.tags || '',
        },
        error: toEditorErrorMessage(error, 'Unable to publish right now.'),
      });
    }
  }
);

router.get('/:workId/edit', requireVerifiedEmail, async (req, res) => {
  const workId = toNumericId(req.params.workId);
  const work = await findWorkById(workId);

  if (!work) {
    return renderWorkNotFound(res);
  }

  if (work.author_id !== req.user.id) {
    return renderOwnershipError(res);
  }

  return res.render('work-editor', {
    mode: 'edit',
    work,
    values: {
      title: work.title,
      summary: work.summary,
      content: work.content,
      fandom: work.fandom,
      rating: work.rating,
      status: work.status,
      tags: work.tags.join(', '),
    },
    error: null,
  });
});

router.post(
  '/:workId/edit',
  requireVerifiedEmail,
  uploadLimiter,
  coverUpload.single('coverImage'),
  verifyCsrf,
  createLimiter,
  async (req, res) => {
    const workId = toNumericId(req.params.workId);
    const work = await findWorkById(workId);

    if (!work) {
      return renderWorkNotFound(res);
    }

    if (work.author_id !== req.user.id) {
      return renderOwnershipError(res);
    }

    let uploadedCover = null;

    try {
      const form = parseOrThrow(workSchema, req.body);
      const tags = normalizeTags(form.tags || '');

      if (req.file) {
        uploadedCover = await uploadCoverImage({
          file: req.file,
          userId: req.user.id,
        });
      }

      await updateWork({
        workId,
        authorId: req.user.id,
        title: form.title,
        summary: form.summary,
        content: form.content,
        fandom: form.fandom,
        rating: form.rating,
        status: form.status,
        wordCount: countWords(form.content),
        coverPath: uploadedCover?.coverPath || null,
        coverStorageKey: uploadedCover?.coverStorageKey || null,
        tags,
      });

      if (uploadedCover?.coverStorageKey && work.cover_storage_key) {
        await removeCoverIfPresent(work.cover_storage_key);
      }

      return res.redirect(`/works/${workId}`);
    } catch (error) {
      if (uploadedCover?.coverStorageKey) {
        await removeCoverIfPresent(uploadedCover.coverStorageKey);
      }

      return res.status(400).render('work-editor', {
        mode: 'edit',
        work,
        values: {
          title: req.body.title || '',
          summary: req.body.summary || '',
          content: req.body.content || '',
          fandom: req.body.fandom || '',
          rating: req.body.rating || 'Teen',
          status: req.body.status || 'WIP',
          tags: req.body.tags || '',
        },
        error: toEditorErrorMessage(error, 'Unable to save right now.'),
      });
    }
  }
);

router.get('/:workId', readLimiter, fullReadLimiter, async (req, res) => {
  const workId = toNumericId(req.params.workId);
  const work = await findWorkById(workId);

  if (!work) {
    return renderWorkNotFound(res);
  }

  const [comments, currentBookmark, userHasKudos, readingProgress] = await Promise.all([
    listCommentsByWork(workId),
    req.user ? findBookmark({ workId, userId: req.user.id }) : Promise.resolve(null),
    req.user ? hasKudos({ workId, userId: req.user.id }) : Promise.resolve(false),
    req.user ? findReadingProgress({ workId, userId: req.user.id }) : Promise.resolve(null),
  ]);

  const hasVerifiedEmail = Boolean(req.user?.emailVerified);
  const hasReaderPass = req.user ? hasValidReaderPass(req, req.user.id) : false;
  const canReadFullStory = Boolean(req.user && hasVerifiedEmail && hasReaderPass);
  const contentLocked = !canReadFullStory;
  const isSearchBot = Boolean(req.requestClassification?.isKnownSearchBot);
  const requestedPreviewCap = isSearchBot
    ? 0
    : req.user
      ? Math.max(40, Math.min(220, Math.floor(work.word_count * 0.18)))
      : Math.max(30, Math.min(120, Math.floor(work.word_count * 0.12)));
  const hiddenWordCount = Math.max(8, Math.min(30, Math.floor(work.word_count * 0.4)));
  const previewCap = Math.max(0, Math.min(requestedPreviewCap, work.word_count - hiddenWordCount));
  const previewBody = contentLocked
    ? previewTextByWords(work.content, previewCap)
    : work.content;
  const lockedStoryText =
    previewBody.trim().length > 0
      ? previewBody
      : 'Full chapter text is available to verified member sessions only.';
  const storyHtml = contentLocked
    ? textToParagraphs(lockedStoryText)
    : textToParagraphsWithWatermark(
        work.content,
        req.user
          ? `${req.user.id}:${req.session?.csrfToken || 'reader-session'}:${work.id}`
          : `guest:${work.id}`
      );

  return res.render('work-detail', {
    work,
    comments,
    userHasKudos,
    currentBookmark,
    readingProgress,
    canReadFullStory,
    contentLocked,
    needsEmailVerification: Boolean(req.user && !hasVerifiedEmail),
    needsHumanCheck: Boolean(req.user && hasVerifiedEmail && contentLocked),
    storyHtml,
    previewWordCount: contentLocked ? countWords(previewBody) : work.word_count,
  });
});

router.post('/:workId/progress', requireVerifiedEmail, verifyCsrf, createLimiter, async (req, res) => {
  const workId = toNumericId(req.params.workId);
  const work = await findWorkById(workId);

  if (!work) {
    return res.status(404).json({ ok: false, message: 'Work not found.' });
  }

  const hasReaderPass = hasValidReaderPass(req, req.user.id);

  if (!hasReaderPass) {
    return res.status(403).json({ ok: false, message: 'Trusted reader access required.' });
  }

  try {
    const { progressPercent, wordsRead } = parseOrThrow(readingProgressSchema, req.body);
    const clampedWordsRead = Math.min(work.word_count, Math.max(0, wordsRead));

    await upsertReadingProgress({
      workId,
      userId: req.user.id,
      progressPercent: Math.round(progressPercent),
      wordsRead: clampedWordsRead,
    });

    return res.status(204).send();
  } catch (error) {
    return res.status(400).json({
      ok: false,
      message: error.message || 'Could not save reading progress.',
    });
  }
});

router.post('/:workId/kudos', requireVerifiedEmail, verifyCsrf, createLimiter, async (req, res) => {
  const workId = toNumericId(req.params.workId);
  const work = await findWorkById(workId);

  if (!work) {
    return renderWorkNotFound(res);
  }

  await insertKudos({ workId, userId: req.user.id });

  return res.redirect(`/works/${workId}`);
});

router.post('/:workId/bookmark', requireVerifiedEmail, verifyCsrf, createLimiter, async (req, res) => {
  const workId = toNumericId(req.params.workId);
  const work = await findWorkById(workId);

  if (!work) {
    return renderWorkNotFound(res);
  }

  try {
    const { note } = parseOrThrow(bookmarkSchema, req.body);

    await upsertBookmark({
      workId,
      userId: req.user.id,
      note,
    });

    return res.redirect(`/works/${workId}`);
  } catch (error) {
    return res.status(400).render('error', {
      statusCode: 400,
      message: error.message || 'Could not save bookmark note.',
    });
  }
});

router.post('/:workId/comments', requireVerifiedEmail, verifyCsrf, createLimiter, async (req, res) => {
  const workId = toNumericId(req.params.workId);
  const work = await findWorkById(workId);

  if (!work) {
    return renderWorkNotFound(res);
  }

  try {
    const { body } = parseOrThrow(commentSchema, req.body);

    await insertComment({
      workId,
      userId: req.user.id,
      body,
    });

    return res.redirect(`/works/${workId}#comments`);
  } catch (error) {
    return res.status(400).render('error', {
      statusCode: 400,
      message: error.message || 'Could not post comment.',
    });
  }
});

module.exports = router;
