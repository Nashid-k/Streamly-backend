export interface UserPreferences {
  uiLanguage: string;
  preferredAudioLanguages: string[];
  preferredSubtitleLanguages: string[];
  dubOption: 'all' | 'dubbed_only' | 'subtitled_only' | 'dual_audio';
}

export interface UserProfile {
  id: string;
  name: string;
  avatarUrl?: string;
  isKids: boolean;
}

export interface User {
  id: string;
  email: string;
  name: string;
  profiles: UserProfile[];
  currentProfileId: string;
  myList: string[]; // array of movie IDs
  preferencesByProfile?: Record<string, UserPreferences>;
}
