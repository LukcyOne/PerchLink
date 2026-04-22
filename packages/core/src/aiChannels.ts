export const AI_PROVIDER_KINDS = ['openai', 'anthropic', 'gemini', 'custom'] as const;
export const AI_PROTOCOL_KINDS = ['openai-compatible', 'anthropic-messages', 'gemini-rest'] as const;
export const AI_EXECUTION_SCOPES = ['local', 'server'] as const;
export const AI_SECRET_SOURCES = ['desktop-keyring', 'server-managed'] as const;
export const AI_SECRET_STATUSES = ['missing', 'configured', 'external'] as const;
export const AI_EXECUTION_MODES = ['local', 'server', 'hybrid'] as const;

export type AiProviderKind = (typeof AI_PROVIDER_KINDS)[number];
export type AiProtocolKind = (typeof AI_PROTOCOL_KINDS)[number];
export type AiExecutionScope = (typeof AI_EXECUTION_SCOPES)[number];
export type AiSecretSource = (typeof AI_SECRET_SOURCES)[number];
export type AiSecretStatus = (typeof AI_SECRET_STATUSES)[number];
export type AiExecutionMode = (typeof AI_EXECUTION_MODES)[number];

export const DEFAULT_AI_TIMEOUT_MS = 30_000;
export const DEFAULT_AI_PRIORITY_STEP = 100;

export interface AiProviderProfileRecord {
  id: string;
  label: string;
  providerKind: AiProviderKind;
  protocolKind: AiProtocolKind;
  executionScope: AiExecutionScope;
  secretSource: AiSecretSource;
  baseUrl: string | null;
  model: string;
  timeoutMs: number;
  enabled: boolean;
  priority: number;
  allowFallback: boolean;
  secretStatus: AiSecretStatus;
  createdAt: string;
  updatedAt: string;
}

export interface SaveAiProviderProfileInput {
  id?: string;
  label: string;
  providerKind: AiProviderKind;
  protocolKind: AiProtocolKind;
  executionScope: AiExecutionScope;
  baseUrl?: string | null;
  model: string;
  timeoutMs?: number;
  enabled?: boolean;
  priority?: number;
  allowFallback?: boolean;
}

export interface AiProviderProfileDraft extends SaveAiProviderProfileInput {
  secret?: string;
}

export interface AiExecutionPreferences {
  mode: AiExecutionMode;
  updatedAt: string | null;
}

export interface SaveAiExecutionPreferencesInput {
  mode: AiExecutionMode;
}

export interface AiProviderPreset {
  id: string;
  label: string;
  providerKind: AiProviderKind;
  protocolKind: AiProtocolKind;
  executionScope: AiExecutionScope;
  baseUrl: string | null;
  model: string;
  enabled: boolean;
  priority: number;
  allowFallback: boolean;
}

export const AI_PROVIDER_PRESETS: AiProviderPreset[] = [
  {
    id: 'openai',
    label: 'OpenAI',
    providerKind: 'openai',
    protocolKind: 'openai-compatible',
    executionScope: 'local',
    baseUrl: null,
    model: '',
    enabled: true,
    priority: DEFAULT_AI_PRIORITY_STEP,
    allowFallback: true,
  },
  {
    id: 'anthropic',
    label: 'Anthropic',
    providerKind: 'anthropic',
    protocolKind: 'anthropic-messages',
    executionScope: 'local',
    baseUrl: null,
    model: '',
    enabled: true,
    priority: DEFAULT_AI_PRIORITY_STEP * 2,
    allowFallback: true,
  },
  {
    id: 'gemini',
    label: 'Gemini',
    providerKind: 'gemini',
    protocolKind: 'gemini-rest',
    executionScope: 'server',
    baseUrl: null,
    model: '',
    enabled: true,
    priority: DEFAULT_AI_PRIORITY_STEP * 3,
    allowFallback: true,
  },
  {
    id: 'custom',
    label: 'Custom Endpoint',
    providerKind: 'custom',
    protocolKind: 'openai-compatible',
    executionScope: 'local',
    baseUrl: '',
    model: '',
    enabled: true,
    priority: DEFAULT_AI_PRIORITY_STEP * 4,
    allowFallback: true,
  },
];

export function deriveAiSecretSource(executionScope: AiExecutionScope): AiSecretSource {
  return executionScope === 'local' ? 'desktop-keyring' : 'server-managed';
}

export function buildDefaultAiExecutionPreferences(): AiExecutionPreferences {
  return {
    mode: 'local',
    updatedAt: null,
  };
}

export function createAiProviderDraftFromPreset(
  preset: AiProviderPreset,
  nextPriority = preset.priority,
): AiProviderProfileDraft {
  return {
    label: preset.label,
    providerKind: preset.providerKind,
    protocolKind: preset.protocolKind,
    executionScope: preset.executionScope,
    baseUrl: preset.baseUrl,
    model: preset.model,
    timeoutMs: DEFAULT_AI_TIMEOUT_MS,
    enabled: preset.enabled,
    priority: nextPriority,
    allowFallback: preset.allowFallback,
    secret: '',
  };
}

export function toAiProviderProfileInput(draft: AiProviderProfileDraft): SaveAiProviderProfileInput {
  return {
    id: draft.id,
    label: draft.label.trim(),
    providerKind: draft.providerKind,
    protocolKind: draft.protocolKind,
    executionScope: draft.executionScope,
    baseUrl: normalizeNullableText(draft.baseUrl),
    model: draft.model.trim(),
    timeoutMs: normalizeTimeout(draft.timeoutMs),
    enabled: draft.enabled ?? true,
    priority: normalizePriority(draft.priority),
    allowFallback: draft.allowFallback ?? true,
  };
}

export function sortAiProviderProfiles(profiles: AiProviderProfileRecord[]): AiProviderProfileRecord[] {
  return [...profiles].sort((left, right) => {
    if (left.priority !== right.priority) {
      return left.priority - right.priority;
    }

    const labelCompare = left.label.localeCompare(right.label);
    if (labelCompare !== 0) {
      return labelCompare;
    }

    return left.id.localeCompare(right.id);
  });
}

function normalizeNullableText(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeTimeout(value: number | undefined): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_AI_TIMEOUT_MS;
  }

  return Math.max(1_000, Math.round(value ?? DEFAULT_AI_TIMEOUT_MS));
}

function normalizePriority(value: number | undefined): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_AI_PRIORITY_STEP;
  }

  return Math.max(0, Math.round(value ?? DEFAULT_AI_PRIORITY_STEP));
}
