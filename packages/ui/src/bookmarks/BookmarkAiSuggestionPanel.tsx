import { useEffect, useMemo, useState } from 'react';
import type {
  ApplyAiSuggestionsInput,
  BookmarkEditableField,
  BookmarkRecord,
  CategoryTreeNode,
} from '@perchlink/core';
import { useTranslation } from 'react-i18next';

interface BookmarkAiSuggestionPanelProps {
  bookmark: BookmarkRecord;
  categories: CategoryTreeNode[];
  isBusy?: boolean;
  onRetryAi?: (bookmarkId: string) => Promise<void>;
  onApplyAi?: (bookmarkId: string, input: ApplyAiSuggestionsInput) => Promise<void>;
}

const AI_FIELDS: Array<{
  field: BookmarkEditableField;
  labelKey: 'fieldCategory' | 'fieldTags' | 'fieldDescription';
}> = [
  { field: 'primaryCategoryId', labelKey: 'fieldCategory' },
  { field: 'tags', labelKey: 'fieldTags' },
  { field: 'description', labelKey: 'fieldDescription' },
];

function flattenCategories(categories: CategoryTreeNode[]): CategoryTreeNode[] {
  return categories.flatMap((category) => [category, ...flattenCategories(category.children)]);
}

function formatCurrentValue(
  field: BookmarkEditableField,
  bookmark: BookmarkRecord,
  categoryLookup: Map<string, string>,
  fallback: string,
) {
  switch (field) {
    case 'primaryCategoryId':
      return categoryLookup.get(bookmark.primaryCategoryId ?? 'system-unsorted') ?? fallback;
    case 'tags':
      return bookmark.tags.length > 0 ? bookmark.tags.map((tag) => `#${tag.label}`).join(', ') : fallback;
    case 'description':
      return bookmark.description ?? bookmark.descriptionExcerpt ?? fallback;
    default:
      return fallback;
  }
}

function formatProposalValue(
  field: BookmarkEditableField,
  bookmark: BookmarkRecord,
  categoryLookup: Map<string, string>,
  fallback: string,
) {
  const aiSuggestion = bookmark.aiSuggestion;
  if (!aiSuggestion) {
    return fallback;
  }

  switch (field) {
    case 'primaryCategoryId':
      return aiSuggestion.proposedPrimaryCategoryId
        ? categoryLookup.get(aiSuggestion.proposedPrimaryCategoryId) ?? aiSuggestion.proposedPrimaryCategoryId
        : fallback;
    case 'tags':
      return aiSuggestion.proposedTags.length > 0 ? aiSuggestion.proposedTags.map((tag) => `#${tag}`).join(', ') : fallback;
    case 'description':
      return aiSuggestion.proposedDescription ?? fallback;
    default:
      return fallback;
  }
}

function hasProposal(field: BookmarkEditableField, bookmark: BookmarkRecord): boolean {
  const aiSuggestion = bookmark.aiSuggestion;
  if (!aiSuggestion) {
    return false;
  }

  switch (field) {
    case 'primaryCategoryId':
      return Boolean(aiSuggestion.proposedPrimaryCategoryId);
    case 'tags':
      return aiSuggestion.proposedTags.length > 0;
    case 'description':
      return Boolean(aiSuggestion.proposedDescription);
    default:
      return false;
  }
}

export function BookmarkAiSuggestionPanel({
  bookmark,
  categories,
  isBusy = false,
  onRetryAi,
  onApplyAi,
}: BookmarkAiSuggestionPanelProps) {
  const { t } = useTranslation();
  const [selectedProtectedFields, setSelectedProtectedFields] = useState<BookmarkEditableField[]>([]);
  const categoryLookup = useMemo(
    () => new Map(flattenCategories(categories).map((category) => [category.id, category.name])),
    [categories],
  );
  const aiSuggestion = bookmark.aiSuggestion;

  useEffect(() => {
    setSelectedProtectedFields([]);
  }, [bookmark.id, aiSuggestion?.runId, aiSuggestion?.status]);

  const untouchedProposals = AI_FIELDS.filter(
    ({ field }) => hasProposal(field, bookmark) && !bookmark.userEditedMask.includes(field),
  );
  const canApplyUntouched = Boolean(onApplyAi) && aiSuggestion?.status === 'ready' && untouchedProposals.length > 0;
  const canReplaceSelected =
    Boolean(onApplyAi) && aiSuggestion?.status === 'ready' && selectedProtectedFields.length > 0;

  const handleReplaceSelected = async () => {
    if (!onApplyAi || selectedProtectedFields.length === 0) {
      return;
    }

    if (typeof window !== 'undefined' && !window.confirm(t('ai.replaceConfirmation'))) {
      return;
    }

    await onApplyAi(bookmark.id, {
      applyUntouched: false,
      replaceFields: selectedProtectedFields,
    });
    setSelectedProtectedFields([]);
  };

  return (
    <section
      aria-label={t('ai.panelTitle')}
      style={{
        display: 'grid',
        gap: 'var(--space-md)',
        padding: 'var(--space-lg)',
        borderRadius: 'var(--radius-md)',
        background: 'rgba(47, 107, 98, 0.08)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--space-md)' }}>
        <div style={{ display: 'grid', gap: 'var(--space-xs)' }}>
          <h3 style={{ margin: 0, fontSize: 'var(--type-heading)' }}>{t('ai.panelTitle')}</h3>
          <div style={{ color: 'var(--color-text-muted)' }}>{t('ai.panelHelper')}</div>
        </div>
        <button
          type="button"
          onClick={() => void onRetryAi?.(bookmark.id)}
          disabled={!onRetryAi || isBusy}
          style={secondaryButtonStyle}
        >
          {t('ai.rerun')}
        </button>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-sm)',
          flexWrap: 'wrap',
        }}
      >
        <span
          style={{
            ...statusChipStyle,
            color:
              aiSuggestion?.status === 'failed'
                ? 'var(--color-destructive)'
                : aiSuggestion?.status === 'ready'
                  ? 'var(--color-accent)'
                  : 'var(--color-text-muted)',
            background:
              aiSuggestion?.status === 'failed'
                ? 'rgba(183, 75, 59, 0.12)'
                : aiSuggestion?.status === 'ready'
                  ? 'rgba(47, 107, 98, 0.12)'
                  : 'rgba(31, 42, 36, 0.08)',
          }}
        >
          {aiSuggestion?.status === 'failed'
            ? t('ai.failed')
            : aiSuggestion?.status === 'ready'
              ? t('ai.ready')
              : aiSuggestion?.status === 'running'
                ? t('ai.analyzing')
                : t('ai.emptyState')}
        </span>
        {aiSuggestion?.status === 'failed' && aiSuggestion.lastError ? (
          <span style={{ color: 'var(--color-destructive)', fontSize: 'var(--type-label)' }}>{aiSuggestion.lastError}</span>
        ) : null}
      </div>

      {!aiSuggestion ? (
        <div style={{ color: 'var(--color-text-muted)' }}>{t('ai.emptyState')}</div>
      ) : (
        <>
          {AI_FIELDS.map(({ field, labelKey }) => {
            const protectedField = bookmark.userEditedMask.includes(field);
            const fieldHasProposal = hasProposal(field, bookmark);
            const checked = selectedProtectedFields.includes(field);

            return (
              <article
                key={field}
                style={{
                  display: 'grid',
                  gap: 'var(--space-sm)',
                  padding: 'var(--space-md)',
                  borderRadius: 'var(--radius-md)',
                  background: '#FFFFFF',
                  border: '1px solid var(--color-border-subtle)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-md)' }}>
                  <strong>{t(`ai.${labelKey}`)}</strong>
                  <span
                    style={{
                      ...statusChipStyle,
                      color: protectedField ? 'var(--color-text-primary)' : 'var(--color-accent)',
                      background: protectedField ? 'var(--color-secondary)' : 'rgba(47, 107, 98, 0.12)',
                    }}
                  >
                    {protectedField ? t('ai.protectedBadge') : t('ai.untouchedBadge')}
                  </span>
                </div>

                <div style={{ display: 'grid', gap: 'var(--space-sm)' }}>
                  <div>
                    <div style={rowLabelStyle}>{t('ai.currentValue')}</div>
                    <div>{formatCurrentValue(field, bookmark, categoryLookup, t('ai.noValue'))}</div>
                  </div>
                  <div>
                    <div style={rowLabelStyle}>{t('ai.proposal')}</div>
                    <div>{formatProposalValue(field, bookmark, categoryLookup, t('ai.noValue'))}</div>
                  </div>
                </div>

                {protectedField && fieldHasProposal ? (
                  <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', fontSize: 'var(--type-label)' }}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        setSelectedProtectedFields((current) =>
                          checked ? current.filter((value) => value !== field) : [...current, field],
                        )
                      }
                    />
                    <span>{t('ai.replaceSelected')}</span>
                  </label>
                ) : null}
              </article>
            );
          })}

          {aiSuggestion.status === 'failed' ? (
            <div style={{ color: 'var(--color-text-muted)' }}>{t('ai.failureDetail')}</div>
          ) : null}

          <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => void onApplyAi?.(bookmark.id, { applyUntouched: true, replaceFields: [] })}
              disabled={!canApplyUntouched || isBusy}
              style={primaryButtonStyle}
            >
              {t('ai.applyUntouched')}
            </button>
            <button
              type="button"
              onClick={() => void handleReplaceSelected()}
              disabled={!canReplaceSelected || isBusy}
              style={secondaryButtonStyle}
            >
              {t('ai.replaceSelected')}
            </button>
          </div>
        </>
      )}
    </section>
  );
}

const statusChipStyle = {
  borderRadius: '999px',
  padding: '6px 10px',
  fontSize: 'var(--type-label)',
  fontWeight: 'var(--weight-semibold)',
} as const;

const rowLabelStyle = {
  fontSize: 'var(--type-label)',
  color: 'var(--color-text-muted)',
  marginBottom: 'var(--space-xs)',
} as const;

const primaryButtonStyle = {
  borderRadius: 'var(--radius-md)',
  border: 'none',
  background: 'var(--color-accent)',
  color: '#FFFFFF',
  padding: '12px 16px',
  fontWeight: 'var(--weight-semibold)',
  cursor: 'pointer',
} as const;

const secondaryButtonStyle = {
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--color-border-subtle)',
  background: '#FFFFFF',
  color: 'var(--color-text-primary)',
  padding: '12px 16px',
  cursor: 'pointer',
} as const;
