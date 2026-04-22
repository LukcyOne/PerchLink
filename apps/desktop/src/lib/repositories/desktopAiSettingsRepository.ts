import type {
  AiExecutionPreferences,
  AiProviderProfileRecord,
  AiSettingsRepository,
  SaveAiExecutionPreferencesInput,
  SaveAiProviderProfileInput,
} from '@perchlink/core';
import {
  clearDesktopAiProviderSecret,
  deleteDesktopAiProviderProfile,
  getDesktopAiExecutionPreferences,
  listDesktopAiProviderProfiles,
  saveDesktopAiExecutionPreferences,
  saveDesktopAiProviderProfile,
  setDesktopAiProviderSecret,
} from '../aiSettingsClient';

export class DesktopAiSettingsRepository implements AiSettingsRepository {
  async listAiProviderProfiles(): Promise<AiProviderProfileRecord[]> {
    return listDesktopAiProviderProfiles();
  }

  async saveAiProviderProfile(input: SaveAiProviderProfileInput): Promise<AiProviderProfileRecord> {
    return saveDesktopAiProviderProfile(input);
  }

  async deleteAiProviderProfile(profileId: string): Promise<void> {
    await deleteDesktopAiProviderProfile(profileId);
  }

  async setAiProviderSecret(profileId: string, secret: string): Promise<void> {
    await setDesktopAiProviderSecret(profileId, secret);
  }

  async clearAiProviderSecret(profileId: string): Promise<void> {
    await clearDesktopAiProviderSecret(profileId);
  }

  async getAiExecutionPreferences(): Promise<AiExecutionPreferences> {
    return getDesktopAiExecutionPreferences();
  }

  async saveAiExecutionPreferences(input: SaveAiExecutionPreferencesInput): Promise<AiExecutionPreferences> {
    return saveDesktopAiExecutionPreferences(input);
  }
}

export const desktopAiSettingsRepository = new DesktopAiSettingsRepository();
