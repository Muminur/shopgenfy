'use client';

import { useState, useEffect, useCallback } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { AlertMessage } from '@/components/feedback/AlertMessage';
import { LoadingSpinner } from '@/components/feedback/LoadingSpinner';
import { APIStatusCard } from '@/components/settings/APIStatusCard';
import { VersionInfoCard } from '@/components/settings/VersionInfoCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Save, Sparkles, Moon, Sun, Monitor, Loader2, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Settings {
  selectedModel: string;
  theme: 'light' | 'dark' | 'system';
  autoSave: boolean;
}

const defaultSettings: Settings = {
  selectedModel: 'gemini-1.5-pro',
  theme: 'system',
  autoSave: true,
};

const availableModels = [
  {
    id: 'gemini-1.5-pro',
    name: 'Gemini 1.5 Pro',
    description: 'Most capable model with best quality outputs',
    recommended: true,
  },
  {
    id: 'gemini-1.5-flash',
    name: 'Gemini 1.5 Flash',
    description: 'Fast and efficient for quick responses',
    recommended: false,
  },
  {
    id: 'gemini-pro',
    name: 'Gemini Pro',
    description: 'Balanced performance and capability',
    recommended: false,
  },
];

const themeOptions = [
  { id: 'light' as const, name: 'Light', icon: Sun, description: 'Light mode' },
  { id: 'dark' as const, name: 'Dark', icon: Moon, description: 'Dark mode' },
  { id: 'system' as const, name: 'System', icon: Monitor, description: 'Follow system preference' },
];

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Load settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const response = await fetch('/api/settings');
        if (response.ok) {
          const data = await response.json();
          setSettings({
            selectedModel: data.selectedModel || defaultSettings.selectedModel,
            theme: data.theme || defaultSettings.theme,
            autoSave: data.autoSave ?? defaultSettings.autoSave,
          });
        }
      } catch {
        setError('Failed to load settings');
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();
  }, []);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
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

  const handleThemeSelect = useCallback((theme: 'light' | 'dark' | 'system') => {
    setSettings((prev) => ({ ...prev, theme }));
  }, []);

  const handleAutoSaveToggle = useCallback((checked: boolean) => {
    setSettings((prev) => ({ ...prev, autoSave: checked }));
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
                      <p className="mt-1 text-sm text-muted-foreground">{model.description}</p>
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
                      <p className="mt-1 text-xs text-muted-foreground">{option.description}</p>
                      {settings.theme === option.id && (
                        <Check className="h-4 w-4 text-primary mt-2" aria-hidden="true" />
                      )}
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
