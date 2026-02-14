import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useSystem } from '../services/SystemContext';
import { useToast } from '../services/ToastContext';
import { SystemSettings } from '../services/types';

const SystemSettingsPanel: React.FC = () => {
    const { settings, setSettings, branding, setBranding } = useSystem();
    const { addToast } = useToast();
    const [localSettings, setLocalSettings] = useState<SystemSettings>(settings);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        setIsLoading(true);
        try {
            const data = await api.settings.get();
            // Merge valid data coming from DB with defaults
            const merged = {
                ...settings,
                aiGlobalEnabled: data.ai_global_enabled === 'true',
                aiQuestionGenEnabled: data.ai_question_gen_enabled === 'true',
                aiGradingEnabled: data.ai_grading_enabled === 'true',
                themePrimaryColor: data.theme_primary_color || settings.themePrimaryColor
            };
            setLocalSettings(merged);
            setSettings(merged);
        } catch (e) {
            console.error("Failed to load settings", e);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async () => {
        setIsLoading(true);
        try {
            // Map strictly typed LocalSettings to loose key-value pairs for DB
            const dbPayload = {
                ai_global_enabled: String(localSettings.aiGlobalEnabled),
                ai_question_gen_enabled: String(localSettings.aiQuestionGenEnabled),
                ai_grading_enabled: String(localSettings.aiGradingEnabled),
                theme_primary_color: localSettings.themePrimaryColor,
                // Add extended fields here as needed
            };

            await api.settings.update(dbPayload);
            setSettings(localSettings);

            // Also update branding context for immediate feedback
            setBranding({ ...branding, primaryColor: localSettings.themePrimaryColor });

            addToast('System settings updated successfully!', 'success');
        } catch (e) {
            addToast('Failed to save settings.', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-6 max-w-4xl mx-auto space-y-8 animate-in fade-in">
            <div>
                <h2 className="text-2xl font-bold mb-2">System Configuration</h2>
                <p className="text-slate-500">Manage global AI features, themes, and platform behavior.</p>
            </div>

            <div className="grid gap-8 md:grid-cols-2">
                {/* AI Section */}
                <section className="space-y-4">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                        <span>🤖</span> AI Intelligence
                    </h3>
                    <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <label className="font-bold block">Master AI Toggle</label>
                                <p className="text-xs text-slate-500">Enable/Disable all AI features globally.</p>
                            </div>
                            <input
                                type="checkbox"
                                className="toggle toggle-indigo"
                                checked={localSettings.aiGlobalEnabled}
                                onChange={e => setLocalSettings({ ...localSettings, aiGlobalEnabled: e.target.checked })}
                            />
                        </div>

                        {localSettings.aiGlobalEnabled && (
                            <div className="pl-4 border-l-2 border-indigo-100 dark:border-slate-700 space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm">Question Generation</span>
                                    <input
                                        type="checkbox"
                                        checked={localSettings.aiQuestionGenEnabled}
                                        onChange={e => setLocalSettings({ ...localSettings, aiQuestionGenEnabled: e.target.checked })}
                                    />
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm">Auto-Grading Assistant</span>
                                    <input
                                        type="checkbox"
                                        checked={localSettings.aiGradingEnabled}
                                        onChange={e => setLocalSettings({ ...localSettings, aiGradingEnabled: e.target.checked })}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </section>

                {/* Theme Section */}
                <section className="space-y-4">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                        <span>🎨</span> Appearance
                    </h3>
                    <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-4">
                        <div>
                            <label className="text-sm font-bold block mb-2">Primary Brand Color</label>
                            <div className="flex items-center gap-4">
                                <input
                                    type="color"
                                    value={localSettings.themePrimaryColor}
                                    onChange={e => setLocalSettings({ ...localSettings, themePrimaryColor: e.target.value })}
                                    className="h-10 w-20 cursor-pointer rounded border border-slate-300"
                                />
                                <span className="text-xs font-mono bg-white dark:bg-black px-2 py-1 rounded border border-slate-200 dark:border-slate-700">
                                    {localSettings.themePrimaryColor}
                                </span>
                            </div>
                        </div>
                    </div>
                </section>
            </div>

            <div className="pt-6 border-t border-slate-100 dark:border-slate-700 flex justify-end">
                <button
                    onClick={handleSave}
                    disabled={isLoading}
                    className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                    {isLoading ? 'Saving...' : 'Save Configuration'}
                </button>
            </div>
        </div>
    );
};

export default SystemSettingsPanel;
