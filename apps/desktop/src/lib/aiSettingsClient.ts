import type {
  AiExecutionPreferences,
  AiProviderProfileRecord,
  SaveAiExecutionPreferencesInput,
  SaveAiProviderProfileInput,
} from '@perchlink/core';
import { invokeDesktop } from './desktopBridge';

interface DesktopAiProviderProfileDto {
  id: string;
  label: string;
  provider_kind: string;
  protocol_kind: string;
  execution_scope: string;
  secret_source: string;
  base_url: string | null;
  model: string;
  timeout_ms: number;
  enabled: boolean;
  priority: number;
  allow_fallback: boolean;
  secret_status: string;
  created_at: string;
  updated_at: string;
}

interface DesktopAiExecutionPreferencesDto {
  mode: string;
  updated_at: string | null;
}

function mapAiProviderProfileDto(dto: DesktopAiProviderProfileDto): AiProviderProfileRecord {
  return {
    id: dto.id,
    label: dto.label,
    providerKind: dto.provider_kind as AiProviderProfileRecord['providerKind'],
    protocolKind: dto.protocol_kind as AiProviderProfileRecord['protocolKind'],
    executionScope: dto.execution_scope as AiProviderProfileRecord['executionScope'],
    secretSource: dto.secret_source as AiProviderProfileRecord['secretSource'],
    baseUrl: dto.base_url,
    model: dto.model,
    timeoutMs: dto.timeout_ms,
    enabled: dto.enabled,
    priority: dto.priority,
    allowFallback: dto.allow_fallback,
    secretStatus: dto.secret_status as AiProviderProfileRecord['secretStatus'],
    createdAt: dto.created_at,
    updatedAt: dto.updated_at,
  };
}

function mapAiExecutionPreferencesDto(dto: DesktopAiExecutionPreferencesDto): AiExecutionPreferences {
  return {
    mode: dto.mode as AiExecutionPreferences['mode'],
    updatedAt: dto.updated_at,
  };
}

export async function listDesktopAiProviderProfiles(): Promise<AiProviderProfileRecord[]> {
  const profiles = await invokeDesktop<DesktopAiProviderProfileDto[]>('desktop_list_ai_provider_profiles');
  return profiles.map(mapAiProviderProfileDto);
}

export async function saveDesktopAiProviderProfile(input: SaveAiProviderProfileInput): Promise<AiProviderProfileRecord> {
  const profile = await invokeDesktop<DesktopAiProviderProfileDto>('desktop_save_ai_provider_profile', { input });
  return mapAiProviderProfileDto(profile);
}

export async function deleteDesktopAiProviderProfile(profileId: string): Promise<void> {
  await invokeDesktop('desktop_delete_ai_provider_profile', { profileId });
}

export async function setDesktopAiProviderSecret(profileId: string, secret: string): Promise<void> {
  await invokeDesktop('desktop_set_ai_provider_secret', { profileId, secret });
}

export async function clearDesktopAiProviderSecret(profileId: string): Promise<void> {
  await invokeDesktop('desktop_clear_ai_provider_secret', { profileId });
}

export async function getDesktopAiExecutionPreferences(): Promise<AiExecutionPreferences> {
  const preferences = await invokeDesktop<DesktopAiExecutionPreferencesDto>('desktop_get_ai_execution_preferences');
  return mapAiExecutionPreferencesDto(preferences);
}

export async function saveDesktopAiExecutionPreferences(
  input: SaveAiExecutionPreferencesInput,
): Promise<AiExecutionPreferences> {
  const preferences = await invokeDesktop<DesktopAiExecutionPreferencesDto>('desktop_save_ai_execution_preferences', {
    input,
  });
  return mapAiExecutionPreferencesDto(preferences);
}
