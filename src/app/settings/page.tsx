'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useTheme } from 'next-themes';
import { MainLayout } from '@/components/layout/MainLayout';
import { AlertMessage } from '@/components/feedback/AlertMessage';
import { LoadingSpinner } from '@/components/feedback/LoadingSpinner';
import { APIStatusCard } from '@/components/settings/APIStatusCard';
import { VersionInfoCard } from '@/components/settings/VersionInfoCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Save,
  Sparkles,
  Moon,
  Sun,
  Monitor,
  Loader2,
  Check,
  Globe,
  Github,
  FolderUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiFetch } from '@/lib/api-client';

type ScreenshotSource = 'website' | 'repo' | 'folder';

// Persisted client-side so the dashboard can honor the preference even when the
// database is unreachable (the settings API is best-effort, localStorage is not).
const SCREENSHOT_SOURCE_STORAGE_KEY = 'shopgenfy_screenshot_source';

interface Settings {
  selectedModel: string;
  theme: 'light' | 'dark' | 'system';
  autoSave: boolean;
  screenshotSource: ScreenshotSource;
}

const defaultSettings: Settings = {
  selectedModel: 'auto',
  theme: 'system',
  autoSave: true,
  screenshotSource: 'website',
};

const availableModels = [
  {
    id: 'auto',
    name: 'Auto',
    description: 'Automatically use the best available model and self-heal if one is retired',
    recommended: true,
  },
  {
    id: 'gemini-flash-latest',
    name: 'Gemini Flash Latest',
    description: 'Self-updating alias that always points at the current flash model',
    recommended: false,
  },
  {
    id: 'gemini-3.5-flash',
    name: 'Gemini 3.5 Flash',
    description: 'Pinned fast model for content analysis',
    recommended: false,
  },
];

const themeOptions = [
  { id: 'light' as const, name: 'Light', icon: Sun, description: 'Light mode' },
  { id: 'dark' as const, name: 'Dark', icon: Moon, description: 'Dark mode' },
  { id: 'system' as const, name: 'System', icon: Monitor, description: 'Follow system preference' },
];

// Selected radio-card options render their description over a bg-primary/5
// tint. text-muted-foreground (#62748e) only hits 4.29:1 against that tinted
// background (#f3f3f4), below WCAG AA's 4.5:1 floor for normal text -- so the
// selected state needs a darker shade. text-slate-600 (#475569) measures
// ~6.83:1 against the same tint, comfortably clearing AA. In dark mode the
// tint sits on the dark card and text-muted-foreground already clears AA
// there (~6.08:1), so we keep it for that theme rather than swapping in a
// color tuned for light-mode contrast.
const selectedDescriptionClass = 'text-slate-600 dark:text-muted-foreground';

const screenshotSourceOptions = [
  {
    id: 'website' as const,
    name: 'Website',
    icon: Globe,
    description: 'Use screenshots pulled from the analyzed website',
  },
  {
    id: 'repo' as const,
    name: 'Repository',
    icon: Github,
    description: 'Use images referenced in the analyzed GitHub repo',
  },
  {
    id: 'folder' as const,
    name: 'Folder (your uploads)',
    icon: FolderUp,
    description: 'Upload your own screenshots and use them directly',
  },
];

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Use next-themes for theme management
  const { setTheme, theme: currentTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Guards the one-time settings load. next-themes hands back a NEW `setTheme`
  // identity every time the theme changes, so a `[setTheme]`-keyed effect would
  // re-fire on every toggle. Without this guard, selecting a theme re-runs the
  // loader, which re-fetches the persisted default (`theme: 'system'`) and
  // immediately overwrites the user's choice — the class flips then reverts.
  const didLoadRef = useRef(false);

  // Ensure component is mounted before accessing theme
  useEffect(() => {
    setMounted(true);
  }, []);

  // Load settings on mount (exactly once — see didLoadRef above).
  useEffect(() => {
    if (didLoadRef.current) return;
    didLoadRef.current = true;

    const readLocalScreenshotSource = (): ScreenshotSource | null => {
      try {
        const stored = localStorage.getItem(SCREENSHOT_SOURCE_STORAGE_KEY);
        if (stored === 'website' || stored === 'repo' || stored === 'folder') {
          return stored;
        }
      } catch {
        /* localStorage unavailable */
      }
      return null;
    };

    const loadSettings = async () => {
      try {
        const response = await apiFetch('/api/settings');
        // Prefer the server value, but fall back to the locally persisted
        // choice so a DB-down session (a normal, supported state for this
        // app) still reflects the user's preference instead of silently
        // resetting to hardcoded defaults.
        const localSource = readLocalScreenshotSource();

        if (response.ok) {
          const data = await response.json();
          const loadedTheme = data.theme || defaultSettings.theme;

          setSettings({
            // API uses selectedGeminiModel, but frontend uses selectedModel
            selectedModel: data.selectedGeminiModel || defaultSettings.selectedModel,
            theme: loadedTheme,
            autoSave: data.autoSave ?? defaultSettings.autoSave,
            screenshotSource:
              data.screenshotSource || localSource || defaultSettings.screenshotSource,
          });
          // Sync the loaded theme preference with next-themes
          setTheme(loadedTheme);
        } else {
          // Settings API unavailable (e.g. 503 while the database is down).
          // Only screenshotSource has a dedicated localStorage cache here;
          // theme is already recovered independently via next-themes' own
          // persistence and the mounted/currentTheme sync effect below, and
          // the model has no local cache to fall back to.
          setSettings((prev) => ({
            ...prev,
            screenshotSource: localSource || defaultSettings.screenshotSource,
          }));
        }
      } catch {
        setError('Failed to load settings');
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();
  }, [setTheme]);

  // Sync settings theme state with current theme from next-themes on mount
  // We only sync when mounted or currentTheme changes, not when settings.theme changes
  // to avoid potential infinite loops
  useEffect(() => {
    if (mounted && currentTheme) {
      const validThemes = ['light', 'dark', 'system'] as const;
      const isValidTheme = validThemes.includes(currentTheme as (typeof validThemes)[number]);
      if (isValidTheme) {
        setSettings((prev) => {
          // Only update if different to avoid unnecessary re-renders
          if (prev.theme !== currentTheme) {
            return { ...prev, theme: currentTheme as Settings['theme'] };
          }
          return prev;
        });
      }
    }
  }, [currentTheme, mounted]);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      // Map frontend field names to API field names
      const apiPayload = {
        selectedGeminiModel: settings.selectedModel,
        theme: settings.theme,
        autoSave: settings.autoSave,
        screenshotSource: settings.screenshotSource,
      };

      // Persist the screenshot source locally first so the dashboard honors it
      // even if the settings API (DB) is unavailable.
      try {
        localStorage.setItem(SCREENSHOT_SOURCE_STORAGE_KEY, settings.screenshotSource);
      } catch {
        /* localStorage unavailable */
      }

      const response = await apiFetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(apiPayload),
      });

      if (!response.ok) {
        throw new Error('Failed to save settings');
      }

      setSuccess('Settings saved successfully!');
    } catch {
      setError('Failed to save settings. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }, [settings]);

  const handleModelSelect = useCallback((modelId: string) => {
    setSettings((prev) => ({ ...prev, selectedModel: modelId }));
  }, []);

  const handleThemeSelect = useCallback(
    (theme: 'light' | 'dark' | 'system') => {
      setSettings((prev) => ({ ...prev, theme }));
      // Apply theme immediately using next-themes
      setTheme(theme);
    },
    [setTheme]
  );

  const handleAutoSaveToggle = useCallback((checked: boolean) => {
    setSettings((prev) => ({ ...prev, autoSave: checked }));
  }, []);

  const handleScreenshotSourceSelect = useCallback((source: ScreenshotSource) => {
    setSettings((prev) => ({ ...prev, screenshotSource: source }));
    try {
      localStorage.setItem(SCREENSHOT_SOURCE_STORAGE_KEY, source);
    } catch {
      /* localStorage unavailable */
    }
  }, []);

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <LoadingSpinner size="lg" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="container max-w-4xl mx-auto py-6 px-4">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground mt-2">
            Configure your preferences and AI model settings
          </p>
        </div>

        {/* Alerts */}
        {error && (
          <div className="mb-6">
            <AlertMessage variant="error" message={error} onDismiss={() => setError(null)} />
          </div>
        )}
        {success && (
          <div className="mb-6">
            <AlertMessage variant="success" message={success} onDismiss={() => setSuccess(null)} />
          </div>
        )}

        <div className="space-y-6">
          {/* AI Model Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                AI Model Selection
              </CardTitle>
              <CardDescription>Choose the Gemini model for content analysis</CardDescription>
            </CardHeader>
            <CardContent>
              <fieldset>
                <legend className="sr-only">Select AI Model for Content Analysis</legend>
                <div className="grid gap-4 sm:grid-cols-3" role="radiogroup">
                  {availableModels.map((model) => (
                    <button
                      key={model.id}
                      type="button"
                      onClick={() => handleModelSelect(model.id)}
                      role="radio"
                      aria-checked={settings.selectedModel === model.id}
                      aria-label={`${model.name}: ${model.description}`}
                      className={cn(
                        'relative flex flex-col items-start rounded-lg border p-4 text-left transition-colors hover:bg-accent focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
                        settings.selectedModel === model.id && 'border-primary bg-primary/5'
                      )}
                    >
                      {model.recommended && (
                        <span className="absolute -top-2 right-2 rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
                          Recommended
                        </span>
                      )}
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{model.name}</span>
                        {settings.selectedModel === model.id && (
                          <Check className="h-4 w-4 text-primary" aria-hidden="true" />
                        )}
                      </div>
                      <p
                        className={cn(
                          'mt-1 text-sm',
                          settings.selectedModel === model.id
                            ? selectedDescriptionClass
                            : 'text-muted-foreground'
                        )}
                      >
                        {model.description}
                      </p>
                    </button>
                  ))}
                </div>
              </fieldset>
            </CardContent>
          </Card>

          {/* Theme Selection */}
          <Card>
            <CardHeader>
              <CardTitle>Theme & Appearance</CardTitle>
              <CardDescription>Customize the look and feel of the application</CardDescription>
            </CardHeader>
            <CardContent>
              <fieldset>
                <legend className="sr-only">Select Theme Appearance</legend>
                <div className="grid gap-4 sm:grid-cols-3" role="radiogroup">
                  {themeOptions.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => handleThemeSelect(option.id)}
                      role="radio"
                      aria-checked={settings.theme === option.id}
                      aria-label={`${option.name} theme: ${option.description}`}
                      className={cn(
                        'flex flex-col items-center rounded-lg border p-4 transition-colors hover:bg-accent focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
                        settings.theme === option.id && 'border-primary bg-primary/5'
                      )}
                    >
                      <option.icon className="h-6 w-6 mb-2" aria-hidden="true" />
                      <span className="font-medium">{option.name}</span>
                      <p
                        className={cn(
                          'mt-1 text-xs',
                          settings.theme === option.id
                            ? selectedDescriptionClass
                            : 'text-muted-foreground'
                        )}
                      >
                        {option.description}
                      </p>
                      {settings.theme === option.id && (
                        <Check className="h-4 w-4 text-primary mt-2" aria-hidden="true" />
                      )}
                    </button>
                  ))}
                </div>
              </fieldset>
            </CardContent>
          </Card>

          {/* Screenshot Source */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FolderUp className="h-5 w-5" />
                Screenshot Source
              </CardTitle>
              <CardDescription>
                Choose where feature-image screenshots come from. Real screenshots are auto-cropped
                to Shopify specs and used directly (no AI needed).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <fieldset>
                <legend className="sr-only">Select Screenshot Source</legend>
                <div className="grid gap-4 sm:grid-cols-3" role="radiogroup">
                  {screenshotSourceOptions.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => handleScreenshotSourceSelect(option.id)}
                      role="radio"
                      aria-checked={settings.screenshotSource === option.id}
                      aria-label={`${option.name}: ${option.description}`}
                      className={cn(
                        'flex flex-col items-start rounded-lg border p-4 text-left transition-colors hover:bg-accent focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
                        settings.screenshotSource === option.id && 'border-primary bg-primary/5'
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <option.icon className="h-4 w-4" aria-hidden="true" />
                        <span className="font-medium">{option.name}</span>
                        {settings.screenshotSource === option.id && (
                          <Check className="h-4 w-4 text-primary" aria-hidden="true" />
                        )}
                      </div>
                      <p
                        className={cn(
                          'mt-1 text-sm',
                          settings.screenshotSource === option.id
                            ? selectedDescriptionClass
                            : 'text-muted-foreground'
                        )}
                      >
                        {option.description}
                      </p>
                    </button>
                  ))}
                </div>
              </fieldset>
            </CardContent>
          </Card>

          {/* Auto-save Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Auto-save</CardTitle>
              <CardDescription>Automatically save your work as you type</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="autosave"
                  checked={settings.autoSave}
                  onCheckedChange={handleAutoSaveToggle}
                />
                <Label htmlFor="autosave" className="cursor-pointer">
                  Enable auto-save
                </Label>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                When enabled, your submissions will be automatically saved every few seconds.
              </p>
            </CardContent>
          </Card>

          {/* API Status and Version Info Cards */}
          <div className="grid gap-6 md:grid-cols-2">
            <APIStatusCard />
            <VersionInfoCard />
          </div>

          {/* Save Button */}
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Settings
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
