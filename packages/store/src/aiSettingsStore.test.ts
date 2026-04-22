import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AiProviderProfileRecord, AiSettingsRepository } from '@perchlink/core';
import { useAiSettingsStore } from './aiSettingsStore';

function createRepositoryMock() {
  let profiles: AiProviderProfileRecord[] = [
    {
      id: 'provider-2',
      label: 'Server Anthropic',
      providerKind: 'anthropic',
      protocolKind: 'anthropic-messages',
      executionScope: 'server',
      secretSource: 'server-managed',
      baseUrl: null,
      model: 'claude-test',
      timeoutMs: 30000,
      enabled: true,
      priority: 200,
      allowFallback: true,
      secretStatus: 'external',
      createdAt: '2026-04-22T00:00:00.000Z',
      updatedAt: '2026-04-22T00:00:00.000Z',
    },
    {
      id: 'provider-1',
      label: 'Local OpenAI',
      providerKind: 'openai',
      protocolKind: 'openai-compatible',
      executionScope: 'local',
      secretSource: 'desktop-keyring',
      baseUrl: null,
      model: 'gpt-test',
      timeoutMs: 30000,
      enabled: true,
      priority: 100,
      allowFallback: true,
      secretStatus: 'missing',
      createdAt: '2026-04-22T00:00:00.000Z',
      updatedAt: '2026-04-22T00:00:00.000Z',
    },
  ];
  let executionPreferences = { mode: 'local' as const, updatedAt: '2026-04-22T00:00:00.000Z' };

  const repository: AiSettingsRepository = {
    listAiProviderProfiles: vi.fn(async () => profiles),
    saveAiProviderProfile: vi.fn(async (input) => {
      const saved: AiProviderProfileRecord = {
        id: input.id ?? 'provider-new',
        label: input.label,
        providerKind: input.providerKind,
        protocolKind: input.protocolKind,
        executionScope: input.executionScope,
        secretSource: input.executionScope === 'local' ? 'desktop-keyring' : 'server-managed',
        baseUrl: input.baseUrl ?? null,
        model: input.model,
        timeoutMs: input.timeoutMs ?? 30000,
        enabled: input.enabled ?? true,
        priority: input.priority ?? 100,
        allowFallback: input.allowFallback ?? true,
        secretStatus: input.executionScope === 'local' ? 'missing' : 'external',
        createdAt: '2026-04-22T00:00:00.000Z',
        updatedAt: '2026-04-22T00:00:00.000Z',
      };
      profiles = [...profiles.filter((profile) => profile.id !== saved.id), saved];
      return saved;
    }),
    deleteAiProviderProfile: vi.fn(async (profileId) => {
      profiles = profiles.filter((profile) => profile.id !== profileId);
    }),
    setAiProviderSecret: vi.fn(async (profileId) => {
      profiles = profiles.map((profile) =>
        profile.id === profileId
          ? {
              ...profile,
              secretStatus: 'configured',
            }
          : profile,
      );
    }),
    clearAiProviderSecret: vi.fn(async (profileId) => {
      profiles = profiles.map((profile) =>
        profile.id === profileId
          ? {
              ...profile,
              secretStatus: 'missing',
            }
          : profile,
      );
    }),
    getAiExecutionPreferences: vi.fn(async () => executionPreferences),
    saveAiExecutionPreferences: vi.fn(async (input) => {
      executionPreferences = {
        mode: input.mode,
        updatedAt: '2026-04-22T01:00:00.000Z',
      };
      return executionPreferences;
    }),
  };

  return repository;
}

describe('useAiSettingsStore', () => {
  beforeEach(() => {
    useAiSettingsStore.setState({
      repository: null,
      profiles: [],
      selectedProfileId: null,
      draft: null,
      executionPreferences: {
        mode: 'local',
        updatedAt: null,
      },
      isLoading: false,
      isSaving: false,
      error: null,
    });
  });

  it('hydrates profiles in stable priority order and selects the first profile', async () => {
    const repository = createRepositoryMock();
    useAiSettingsStore.getState().configureRepository(repository);

    await useAiSettingsStore.getState().hydrate();

    const state = useAiSettingsStore.getState();
    expect(state.profiles.map((profile) => profile.id)).toEqual(['provider-1', 'provider-2']);
    expect(state.selectedProfileId).toBe('provider-1');
    expect(state.draft?.label).toBe('Local OpenAI');
  });

  it('creates a preset draft and saves metadata separately from the secret', async () => {
    const repository = createRepositoryMock();
    useAiSettingsStore.getState().configureRepository(repository);
    await useAiSettingsStore.getState().hydrate();

    useAiSettingsStore.getState().createProfileFromPreset('custom');
    useAiSettingsStore.getState().updateDraft({
      label: 'Custom Gateway',
      executionScope: 'local',
      model: 'gateway-model',
      baseUrl: 'https://gateway.example/v1',
      secret: 'new-secret',
    });

    await useAiSettingsStore.getState().saveDraft();

    expect(repository.saveAiProviderProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        label: 'Custom Gateway',
        baseUrl: 'https://gateway.example/v1',
        model: 'gateway-model',
      }),
    );
    expect(repository.saveAiProviderProfile).not.toHaveBeenCalledWith(expect.objectContaining({ secret: 'new-secret' }));
    expect(repository.setAiProviderSecret).toHaveBeenCalledWith('provider-new', 'new-secret');
  });

  it('persists execution mode changes through the repository', async () => {
    const repository = createRepositoryMock();
    useAiSettingsStore.getState().configureRepository(repository);
    await useAiSettingsStore.getState().hydrate();

    await useAiSettingsStore.getState().saveExecutionMode('hybrid');

    expect(useAiSettingsStore.getState().executionPreferences.mode).toBe('hybrid');
    expect(repository.saveAiExecutionPreferences).toHaveBeenCalledWith({ mode: 'hybrid' });
  });
});
