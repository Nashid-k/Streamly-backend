import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { User, UserPreferences, UserProfile } from './users.types';

@Injectable()
export class UsersService implements OnModuleInit {
  private readonly logger = new Logger(UsersService.name);
  // Keep demo state outside `dist` so production rebuilds do not discard it.
  private readonly statePath = process.env.USER_STATE_FILE || join(process.cwd(), 'data', 'user.json');
  private readonly user: User = {
    id: process.env.DEFAULT_USER_ID || 'guest',
    email: process.env.DEFAULT_USER_EMAIL || 'user@netflix.com',
    name: process.env.DEFAULT_USER_NAME || 'Streamer',
    profiles: [
      {
        id: 'prof-1',
        name: 'Classic',
        avatarUrl: 'https://upload.wikimedia.org/wikipedia/commons/0/0b/Netflix-avatar.png',
        isKids: false,
      },
      {
        id: 'prof-2',
        name: 'Kids',
        avatarUrl: 'https://wallpapers.com/images/hd/netflix-profile-pictures-1000-x-1000-88osjt27xavuhybs.jpg',
        isKids: true,
      },
      {
        id: 'prof-3',
        name: 'Chill',
        avatarUrl: 'https://wallpapers.com/images/hd/netflix-profile-pictures-1000-x-1000-vnlmbypxyeyadjbd.jpg',
        isKids: false,
      },
      {
        id: 'prof-4',
        name: 'Family',
        avatarUrl: 'https://wallpapers.com/images/hd/netflix-profile-pictures-1000-x-1000-2y9q9vpf9z0ae0ot.jpg',
        isKids: false,
      },
    ],
    currentProfileId: 'prof-1',
    myList: [],
  };

  getUser(): User {
    return this.user;
  }

  async onModuleInit() {
    try {
      let contents: string;
      let migratedLegacyState = false;
      try {
        contents = await readFile(this.statePath, 'utf8');
      } catch (error: any) {
        if (error?.code !== 'ENOENT') throw error;
        const legacyStatePath = join(__dirname, '..', 'data', 'user.json');
        contents = await readFile(legacyStatePath, 'utf8');
        migratedLegacyState = legacyStatePath !== this.statePath;
      }

      const saved = JSON.parse(contents) as Partial<User>;
      if (Array.isArray(saved.myList)) this.user.myList = saved.myList.filter((id): id is string => typeof id === 'string');
      if (typeof saved.currentProfileId === 'string' && this.user.profiles.some((profile) => profile.id === saved.currentProfileId)) {
        this.user.currentProfileId = saved.currentProfileId;
      }
      // Migrate the former account-wide preference object to the active profile.
      const legacy = (saved as any).preferences;
      const savedByProfile = saved.preferencesByProfile;
      if (savedByProfile && typeof savedByProfile === 'object') {
        this.user.preferencesByProfile = Object.fromEntries(Object.entries(savedByProfile).map(([profileId, value]) => [profileId, this.normalizePreferences(value)]));
      } else if (legacy) {
        this.user.preferencesByProfile = { [this.user.currentProfileId]: this.normalizePreferences(legacy) };
      }
      if (migratedLegacyState) this.persist();
    } catch (error: any) {
      if (error?.code !== 'ENOENT') this.logger.warn(`Could not restore user state: ${error?.message || 'unknown error'}`);
    }
  }

  private persist() {
    const data = JSON.stringify({
      currentProfileId: this.user.currentProfileId,
      myList: this.user.myList,
      preferencesByProfile: this.user.preferencesByProfile,
    });
    const directory = join(this.statePath, '..');
    void mkdir(directory, { recursive: true })
      .then(() => writeFile(`${this.statePath}.tmp`, data, 'utf8'))
      .then(() => rename(`${this.statePath}.tmp`, this.statePath))
      .catch((error) => this.logger.error(`Could not persist user state: ${error.message}`));
  }

  setCurrentProfile(profileId: string): UserProfile {
    const target = this.user.profiles.find((p) => p.id === profileId);
    if (target) {
      this.user.currentProfileId = profileId;
      this.persist();
      return target;
    }
    return this.user.profiles[0];
  }

  getMyList(): string[] {
    return this.user.myList;
  }

  toggleMyList(movieId: string): { myList: string[]; isSaved: boolean } {
    const index = this.user.myList.indexOf(movieId);
    let isSaved = false;
    if (index >= 0) {
      this.user.myList.splice(index, 1);
      isSaved = false;
    } else {
      this.user.myList.push(movieId);
      isSaved = true;
    }
    this.persist();
    return { myList: this.user.myList, isSaved };
  }

  private normalizePreferences(preferences: any) {
    const legacyLanguages = Array.isArray(preferences?.preferredLanguages) ? preferences.preferredLanguages : [];
    const languages = (value: unknown) => Array.isArray(value)
      ? value.filter((language: unknown): language is string => typeof language === 'string' && language !== 'All').slice(0, 5)
      : legacyLanguages.filter((language: unknown): language is string => typeof language === 'string' && language !== 'All').slice(0, 5);
    return {
      uiLanguage: typeof preferences?.uiLanguage === 'string' ? preferences.uiLanguage : 'English',
      preferredAudioLanguages: languages(preferences?.preferredAudioLanguages),
      preferredSubtitleLanguages: languages(preferences?.preferredSubtitleLanguages),
      dubOption: ['all', 'dubbed_only', 'subtitled_only', 'dual_audio'].includes(preferences?.dubOption) ? preferences.dubOption : 'all',
    } as UserPreferences;
  }

  updatePreferences(preferences: any) {
    this.user.preferencesByProfile ||= {};
    this.user.preferencesByProfile[this.user.currentProfileId] = this.normalizePreferences(preferences);
    this.persist();
    return this.user.preferencesByProfile[this.user.currentProfileId];
  }
}
