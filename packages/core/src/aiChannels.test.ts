import { describe, expect, it } from 'vitest';
import {
  AI_PROVIDER_PRESETS,
  buildDefaultAiExecutionPreferences,
  createAiProviderDraftFromPreset,
  deriveAiSecretSource,
  sortAiProviderProfiles,
  toAiProviderProfileInput,
} from './aiChannels';

describe('toAiProviderProfileInput', () => {
  it('keeps only syncable metadata and strips the raw secret field', () => {
    const input = toAiProviderProfileInput({
      id: 'provider-1',
      label: '  OpenAI Local  ',
      providerKind: 'openai',
      protocolKind: 'openai-compatible',
      executionScope: 'local',
      baseUrl: '  https://example.test/v1  ',
      model: '  gpt-test  ',
      timeoutMs: 500,
      priority: -5,
      enabled: true,
      allowFallback: false,
      secret: 'super-secret-value',
    });

    expect(input).toEqual({
      id: 'provider-1',
      label: 'OpenAI Local',
      providerKind: 'openai',
      protocolKind: 'openai-compatible',
      executionScope: 'local',
      baseUrl: 'https://example.test/v1',
      model: 'gpt-test',
      timeoutMs: 1000,
      enabled: true,
      priority: 0,
      allowFallback: false,
    });
    expect('secret' in input).toBe(false);
  });
});

describe('deriveAiSecretSource', () => {
  it('maps execution scope to the correct redacted secret source', () => {
    expect(deriveAiSecretSource('local')).toBe('desktop-keyring');
    expect(deriveAiSecretSource('server')).toBe('server-managed');
  });
});

describe('createAiProviderDraftFromPreset', () => {
  it('creates a mutable draft from a preset with an empty secret', () => {
    const preset = AI_PROVIDER_PRESETS[0];
    const draft = createAiProviderDraftFromPreset(preset, 250);

    expect(draft.label).toBe(preset.label);
    expect(draft.priority).toBe(250);
    expect(draft.secret).toBe('');
  });
});

describe('sortAiProviderProfiles', () => {
  it('sorts providers deterministically by priority then label', () => {
    const sorted = sortAiProviderProfiles([
      {
        id: 'c',
        label: 'Zulu',
        providerKind: 'custom',
        protocolKind: 'openai-compatible',
        executionScope: 'local',
        secretSource: 'desktop-keyring',
        baseUrl: 'https://example.test',
        model: 'zeta',
        timeoutMs: 30000,
        enabled: true,
        priority: 200,
        allowFallback: true,
        secretStatus: 'missing',
        createdAt: '2026-04-22T00:00:00.000Z',
        updatedAt: '2026-04-22T00:00:00.000Z',
      },
      {
        id: 'a',
        label: 'Alpha',
        providerKind: 'openai',
        protocolKind: 'openai-compatible',
        executionScope: 'local',
        secretSource: 'desktop-keyring',
        baseUrl: null,
        model: 'alpha',
        timeoutMs: 30000,
        enabled: true,
        priority: 100,
        allowFallback: true,
        secretStatus: 'configured',
        createdAt: '2026-04-22T00:00:00.000Z',
        updatedAt: '2026-04-22T00:00:00.000Z',
      },
      {
        id: 'b',
        label: 'Beta',
        providerKind: 'anthropic',
        protocolKind: 'anthropic-messages',
        executionScope: 'server',
        secretSource: 'server-managed',
        baseUrl: null,
        model: 'beta',
        timeoutMs: 30000,
        enabled: true,
        priority: 100,
        allowFallback: false,
        secretStatus: 'external',
        createdAt: '2026-04-22T00:00:00.000Z',
        updatedAt: '2026-04-22T00:00:00.000Z',
      },
    ]);

    expect(sorted.map((profile) => profile.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('buildDefaultAiExecutionPreferences', () => {
  it('starts in local mode until the user selects server or hybrid routing', () => {
    expect(buildDefaultAiExecutionPreferences()).toEqual({
      mode: 'local',
      updatedAt: null,
    });
  });
});
