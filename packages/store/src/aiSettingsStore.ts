import { create } from 'zustand';
import {
  AI_PROVIDER_PRESETS,
  buildDefaultAiExecutionPreferences,
  createAiProviderDraftFromPreset,
  sortAiProviderProfiles,
  toAiProviderProfileInput,
  type AiExecutionMode,
  type AiExecutionPreferences,
  type AiProviderPreset,
  type AiProviderProfileDraft,
  type AiProviderProfileRecord,
  type AiSettingsRepository,
} from '@perchlink/core';

export interface AiSettingsStoreState {
  repository: AiSettingsRepository | null;
  profiles: AiProviderProfileRecord[];
  selectedProfileId: string | null;
  draft: AiProviderProfileDraft | null;
  executionPreferences: AiExecutionPreferences;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  configureRepository: (repository: AiSettingsRepository) => void;
  hydrate: () => Promise<void>;
  selectProfile: (profileId: string | null) => void;
  createProfileFromPreset: (presetId: string) => void;
  updateDraft: (patch: Partial<AiProviderProfileDraft>) => void;
  saveDraft: () => Promise<void>;
  deleteSelectedProfile: () => Promise<void>;
  clearSelectedSecret: () => Promise<void>;
  saveExecutionMode: (mode: AiExecutionMode) => Promise<void>;
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'AI settings action failed.';
}

function getRepository(repository: AiSettingsRepository | null): AiSettingsRepository {
  if (!repository) {
    throw new Error('AI settings repository has not been configured.');
  }

  return repository;
}

function mapProfileToDraft(profile: AiProviderProfileRecord): AiProviderProfileDraft {
  return {
    id: profile.id,
    label: profile.label,
    providerKind: profile.providerKind,
    protocolKind: profile.protocolKind,
    executionScope: profile.executionScope,
    baseUrl: profile.baseUrl,
    model: profile.model,
    timeoutMs: profile.timeoutMs,
    enabled: profile.enabled,
    priority: profile.priority,
    allowFallback: profile.allowFallback,
    secret: '',
  };
}

function getNextPriority(profiles: AiProviderProfileRecord[], preset: AiProviderPreset): number {
  if (profiles.length === 0) {
    return preset.priority;
  }

  return Math.max(...profiles.map((profile) => profile.priority)) + 100;
}

export const useAiSettingsStore = create<AiSettingsStoreState>((set, get) => ({
  repository: null,
  profiles: [],
  selectedProfileId: null,
  draft: null,
  executionPreferences: buildDefaultAiExecutionPreferences(),
  isLoading: false,
  isSaving: false,
  error: null,
  configureRepository: (repository) => set({ repository }),
  hydrate: async () => {
    const repository = getRepository(get().repository);
    set({ isLoading: true, error: null });

    try {
      const [profiles, executionPreferences] = await Promise.all([
        repository.listAiProviderProfiles(),
        repository.getAiExecutionPreferences(),
      ]);
      const sortedProfiles = sortAiProviderProfiles(profiles);
      const selectedProfileId =
        get().selectedProfileId && sortedProfiles.some((profile) => profile.id === get().selectedProfileId)
          ? get().selectedProfileId
          : sortedProfiles[0]?.id ?? null;
      const selectedProfile = selectedProfileId
        ? sortedProfiles.find((profile) => profile.id === selectedProfileId) ?? null
        : null;

      set({
        profiles: sortedProfiles,
        selectedProfileId,
        draft: selectedProfile ? mapProfileToDraft(selectedProfile) : null,
        executionPreferences,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      set({ isLoading: false, error: toErrorMessage(error) });
      throw error;
    }
  },
  selectProfile: (profileId) => {
    const selectedProfile = profileId ? get().profiles.find((profile) => profile.id === profileId) ?? null : null;
    set({
      selectedProfileId: selectedProfile?.id ?? null,
      draft: selectedProfile ? mapProfileToDraft(selectedProfile) : null,
      error: null,
    });
  },
  createProfileFromPreset: (presetId) => {
    const preset = AI_PROVIDER_PRESETS.find((candidate) => candidate.id === presetId);
    if (!preset) {
      return;
    }

    const draft = createAiProviderDraftFromPreset(preset, getNextPriority(get().profiles, preset));
    set({
      selectedProfileId: null,
      draft,
      error: null,
    });
  },
  updateDraft: (patch) =>
    set((state) => ({
      draft: state.draft
        ? {
            ...state.draft,
            ...patch,
          }
        : state.draft,
    })),
  saveDraft: async () => {
    const repository = getRepository(get().repository);
    const draft = get().draft;
    if (!draft) {
      return;
    }

    set({ isSaving: true, error: null });

    try {
      const profile = await repository.saveAiProviderProfile(toAiProviderProfileInput(draft));

      if (draft.executionScope === 'local') {
        const trimmedSecret = draft.secret?.trim() ?? '';
        if (trimmedSecret.length > 0) {
          await repository.setAiProviderSecret(profile.id, trimmedSecret);
        }
      }

      await get().hydrate();
      set((state) => ({
        selectedProfileId: profile.id,
        draft: mapProfileToDraft(state.profiles.find((entry) => entry.id === profile.id) ?? profile),
        isSaving: false,
      }));
    } catch (error) {
      set({ isSaving: false, error: toErrorMessage(error) });
      throw error;
    }
  },
  deleteSelectedProfile: async () => {
    const repository = getRepository(get().repository);
    const selectedProfileId = get().selectedProfileId;
    if (!selectedProfileId) {
      set({ draft: null, error: null });
      return;
    }

    set({ isSaving: true, error: null });

    try {
      await repository.deleteAiProviderProfile(selectedProfileId);
      await get().hydrate();
      set({ isSaving: false });
    } catch (error) {
      set({ isSaving: false, error: toErrorMessage(error) });
      throw error;
    }
  },
  clearSelectedSecret: async () => {
    const repository = getRepository(get().repository);
    const selectedProfileId = get().selectedProfileId;
    if (!selectedProfileId) {
      set((state) => ({
        draft: state.draft
          ? {
              ...state.draft,
              secret: '',
            }
          : null,
      }));
      return;
    }

    set({ isSaving: true, error: null });

    try {
      await repository.clearAiProviderSecret(selectedProfileId);
      await get().hydrate();
      set({ isSaving: false });
    } catch (error) {
      set({ isSaving: false, error: toErrorMessage(error) });
      throw error;
    }
  },
  saveExecutionMode: async (mode) => {
    const repository = getRepository(get().repository);
    set({ isSaving: true, error: null });

    try {
      const executionPreferences = await repository.saveAiExecutionPreferences({ mode });
      set({ executionPreferences, isSaving: false });
    } catch (error) {
      set({ isSaving: false, error: toErrorMessage(error) });
      throw error;
    }
  },
}));
