'use client';

import React, { useState, useEffect } from 'react';
import {
  Settings,
  PhoneCall,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Save,
  Globe2,
  Clock,
  Radio,
  Zap,
  Key,
  ExternalLink,
  Check,
  RefreshCw,
  Server,
  Lock,
} from 'lucide-react';
import { fetchAIStatus, configureAI, testAIConnection } from '@/lib/api';
import { AIStatus } from '@/lib/types';

interface ProviderPreset {
  id: string;
  name: string;
  apiBase: string;
  defaultModel: string;
  keyUrl: string;
  helpText: string;
}

const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    id: 'openrouter',
    name: 'OpenRouter (Hosted Gemma)',
    apiBase: 'https://openrouter.ai/api/v1',
    defaultModel: 'google/gemma-2-9b-it',
    keyUrl: 'https://openrouter.ai/keys',
    helpText: 'Recommended: Hosted Gemma 2 / 9B via OpenRouter high-speed cloud inference.',
  },
  {
    id: 'groq',
    name: 'Groq Cloud (Ultra Fast)',
    apiBase: 'https://api.groq.com/openai/v1',
    defaultModel: 'gemma2-9b-it',
    keyUrl: 'https://console.groq.com/keys',
    helpText: 'Ultra-low latency inference for Gemma 2 / 9B on LPU hardware.',
  },
  {
    id: 'google',
    name: 'Google AI Studio',
    apiBase: 'https://generativelanguage.googleapis.com/v1beta/openai/',
    defaultModel: 'gemma-2-27b-it',
    keyUrl: 'https://aistudio.google.com/app/apikey',
    helpText: 'Direct Google API for Gemma and Gemini models.',
  },
  {
    id: 'together',
    name: 'Together AI',
    apiBase: 'https://api.together.xyz/v1',
    defaultModel: 'google/gemma-2-9b-it',
    keyUrl: 'https://api.together.ai/settings/api-keys',
    helpText: 'Fast open-source cloud inference for Gemma.',
  },
  {
    id: 'ollama',
    name: 'Local Ollama Runtime',
    apiBase: 'http://localhost:11434',
    defaultModel: 'gemma4:latest',
    keyUrl: '',
    helpText: 'Self-hosted on this machine via Ollama.',
  },
  {
    id: 'custom',
    name: 'Custom OpenAI-Compatible API',
    apiBase: '',
    defaultModel: 'gemma-model-name',
    keyUrl: '',
    helpText: 'Any hosted vLLM, LMStudio, or custom cloud endpoint.',
  },
];

export default function SettingsPage() {
  // Active backend status (fetched directly from backend GET /api/ai/status)
  const [activeStatus, setActiveStatus] = useState<AIStatus | null>(null);

  // Provider configuration form state
  const [selectedProviderId, setSelectedProviderId] = useState('openrouter');
  const [apiBase, setApiBase] = useState('https://openrouter.ai/api/v1');
  const [modelName, setModelName] = useState('google/gemma-2-9b-it');
  const [apiKey, setApiKey] = useState('');
  const [mode, setMode] = useState('online');

  // Test state
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    latency_ms?: number;
    preview?: string;
  } | null>(null);

  // Save state
  const [saving, setSaving] = useState(false);
  const [savedSuccessMessage, setSavedSuccessMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Twilio and other settings
  const [demoMode, setDemoMode] = useState(true);

  // Load current backend AI status on mount
  const refreshStatus = async () => {
    try {
      const data: AIStatus = await fetchAIStatus();
      setActiveStatus(data);
      if (data.api_base) setApiBase(data.api_base);
      if (data.model_name) setModelName(data.model_name);
      if (data.mode) setMode(data.mode);

      // Match preset if exists
      const matched = PROVIDER_PRESETS.find(
        (p) =>
          p.id === data.provider.toLowerCase() ||
          (p.apiBase && data.api_base && data.api_base.toLowerCase().includes(p.id))
      );
      if (matched) {
        setSelectedProviderId(matched.id);
      } else {
        setSelectedProviderId('custom');
      }
    } catch (err) {
      console.error('Failed to load active AI status', err);
    }
  };

  useEffect(() => {
    refreshStatus();
  }, []);

  const handleSelectPreset = (preset: ProviderPreset) => {
    setSelectedProviderId(preset.id);
    setApiBase(preset.apiBase);
    setModelName(preset.defaultModel);
    setMode(preset.id === 'ollama' ? 'ollama' : 'online');
    setTestResult(null);
  };

  const handleTestConnection = async () => {
    try {
      setTesting(true);
      setTestResult(null);
      const data = await testAIConnection({
        api_base: apiBase.trim(),
        model_name: modelName.trim(),
        api_key: apiKey.trim() || undefined,
      });
      setTestResult({
        success: data.success,
        message: data.message || (data.success ? 'Connected successfully!' : 'Connection failed'),
        latency_ms: data.latency_ms,
        preview: data.response_preview,
      });
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'Network request failed',
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSaveAndApply = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setSaveError(null);
      setSavedSuccessMessage(null);

      const updatedStatus: AIStatus = await configureAI({
        api_base: apiBase.trim(),
        model_name: modelName.trim(),
        api_key: apiKey.trim() || undefined,
        mode: mode,
        provider: selectedProviderId,
      });

      setActiveStatus(updatedStatus);
      // Clear password field from DOM memory once safely sent to server
      setApiKey('');
      setSavedSuccessMessage(
        `Successfully applied and persisted active model: ${updatedStatus.provider.toUpperCase()} (${updatedStatus.model_name}) in ${updatedStatus.mode} mode!`
      );
      setTimeout(() => setSavedSuccessMessage(null), 5000);
    } catch (err: any) {
      setSaveError(err.message || 'Failed to activate AI configuration');
    } finally {
      setSaving(false);
    }
  };

  const currentPreset = PROVIDER_PRESETS.find((p) => p.id === selectedProviderId);

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
          System Configuration & AI Model Setup
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Configure hosted Gemma cloud endpoints (OpenRouter, Groq, Google AI Studio) or local runtimes for voice IVR intent extraction.
        </p>
      </div>

      {/* ACTIVE BACKEND-REPORTED MODEL STATUS CARD */}
      <div className="bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 text-white p-5 rounded-2xl shadow-md border border-purple-800 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Server className="w-5 h-5 text-purple-300" />
            <h2 className="text-sm font-bold tracking-wide uppercase text-purple-200">
              Active Backend AI Runtime
            </h2>
          </div>
          {activeStatus && (
            <span
              className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                activeStatus.is_online
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40'
                  : 'bg-amber-500/20 text-amber-300 border-amber-400/40'
              }`}
            >
              {activeStatus.is_online ? '● Online Hosted Model Active' : '○ Local Engine Active'}
            </span>
          )}
        </div>

        {activeStatus ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs pt-1">
            <div className="bg-white/10 rounded-xl p-3 backdrop-blur-sm border border-white/10">
              <span className="text-[10px] text-purple-200 uppercase block font-semibold">Active Provider</span>
              <strong className="text-sm font-bold text-white capitalize">{activeStatus.provider}</strong>
            </div>
            <div className="bg-white/10 rounded-xl p-3 backdrop-blur-sm border border-white/10">
              <span className="text-[10px] text-purple-200 uppercase block font-semibold">Model ID</span>
              <strong className="text-xs font-mono font-bold text-purple-100 truncate block" title={activeStatus.model_name}>
                {activeStatus.model_name}
              </strong>
            </div>
            <div className="bg-white/10 rounded-xl p-3 backdrop-blur-sm border border-white/10">
              <span className="text-[10px] text-purple-200 uppercase block font-semibold">Endpoint Mode</span>
              <strong className="text-xs font-mono font-bold text-white">{activeStatus.mode}</strong>
            </div>
            <div className="bg-white/10 rounded-xl p-3 backdrop-blur-sm border border-white/10">
              <span className="text-[10px] text-purple-200 uppercase block font-semibold">API Key Status</span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <Lock className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-xs font-semibold text-emerald-300">
                  {activeStatus.has_api_key ? 'Stored Server-Side' : 'Not configured'}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-xs text-purple-300 animate-pulse">Loading active backend status...</div>
        )}

        <div className="text-[11px] text-purple-200/80 flex items-center justify-between pt-1">
          <span>
            This configuration is synchronized with the <strong>IVR Simulator</strong> and live telephone webhooks.
          </span>
          <button
            type="button"
            onClick={refreshStatus}
            className="inline-flex items-center gap-1 text-[11px] text-purple-200 hover:text-white underline"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {savedSuccessMessage && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>{savedSuccessMessage}</span>
        </div>
      )}

      {saveError && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
          <span>{saveError}</span>
        </div>
      )}

      {/* ONLINE GEMMA API CONFIGURATION CARD */}
      <div className="bg-white p-6 rounded-2xl border border-purple-200 shadow-md space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
              <Zap className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Configure Cloud / Hosted Gemma Model</h3>
              <p className="text-[11px] text-slate-500">Run Gemma with zero local GPU usage via high-speed cloud endpoints</p>
            </div>
          </div>
          <span className="text-[10px] font-bold bg-purple-50 text-purple-700 px-2.5 py-1 rounded-full border border-purple-200">
            Cloud NLU Adapter
          </span>
        </div>

        {/* Provider Preset Selector Tabs */}
        <div className="space-y-2">
          <label className="block text-xs font-semibold text-slate-700">
            Select Online Provider / Preset:
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {PROVIDER_PRESETS.map((preset) => {
              const isSelected = selectedProviderId === preset.id;
              return (
                <button
                  type="button"
                  key={preset.id}
                  onClick={() => handleSelectPreset(preset)}
                  className={`p-3 rounded-xl border text-left text-xs transition ${
                    isSelected
                      ? 'border-purple-600 bg-purple-50/60 ring-2 ring-purple-600/20 text-purple-950 font-bold'
                      : 'border-slate-200 hover:border-slate-300 text-slate-700 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span>{preset.name}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-purple-600" />}
                  </div>
                </button>
              );
            })}
          </div>
          {currentPreset?.helpText && (
            <p className="text-[11px] text-slate-500 pt-1">{currentPreset.helpText}</p>
          )}
        </div>

        {/* API Endpoint & Model inputs */}
        <form onSubmit={handleSaveAndApply} className="space-y-4 pt-2 border-t border-slate-100">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                API Base URL *
              </label>
              <input
                type="text"
                required
                placeholder="https://openrouter.ai/api/v1"
                value={apiBase}
                onChange={(e) => setApiBase(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Gemma Model Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. google/gemma-2-9b-it"
                value={modelName}
                onChange={(e) => setModelName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1 text-xs">
              <label className="font-semibold text-slate-700 flex items-center gap-1">
                <Key className="w-3.5 h-3.5 text-purple-600" />
                <span>API Key (Stored securely server-side in MongoDB, never exposed to client)</span>
              </label>
              {currentPreset?.keyUrl && (
                <a
                  href={currentPreset.keyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-purple-600 hover:text-purple-800 font-medium inline-flex items-center gap-1 text-[11px]"
                >
                  <span>Get API Key</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
            <input
              type="password"
              placeholder={
                activeStatus?.has_api_key
                  ? '•••••••••••••••• (Key already configured on server; leave blank to keep unchanged)'
                  : 'sk-or-... or gsk_... (Required for cloud inference)'
              }
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600"
            />
          </div>

          {/* Test Connection Result Box */}
          {testResult && (
            <div
              className={`p-3.5 rounded-xl border text-xs space-y-1 ${
                testResult.success
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-rose-50 border-rose-200 text-rose-900'
              }`}
            >
              <div className="flex items-center gap-1.5 font-bold">
                {testResult.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600" />
                )}
                <span>{testResult.message}</span>
              </div>
              {testResult.latency_ms && (
                <div className="text-[11px] font-mono opacity-80">
                  Response Latency: <strong>{testResult.latency_ms} ms</strong>
                </div>
              )}
              {testResult.preview && (
                <pre className="p-2 bg-white/70 rounded border border-emerald-200 font-mono text-[10px] overflow-x-auto">
                  {testResult.preview}
                </pre>
              )}
            </div>
          )}

          {/* Action buttons */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
            <button
              type="button"
              disabled={testing || !apiBase || !modelName}
              onClick={handleTestConnection}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 transition disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${testing ? 'animate-spin' : ''}`} />
              <span>{testing ? 'Testing Endpoint...' : 'Test Connection Live'}</span>
            </button>

            <button
              type="submit"
              disabled={saving}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 shadow-md transition disabled:opacity-60"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Activating on Server...' : 'Apply & Activate Online Model'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Telephony & Demonstration Settings */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-teal-100 text-teal-700 flex items-center justify-center font-bold">
              <PhoneCall className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Twilio Voice Telephony & Webhooks</h3>
              <p className="text-[11px] text-slate-500">Inbound call speech gathering and TwiML generation</p>
            </div>
          </div>
          <span className="text-[10px] font-bold bg-emerald-50 text-emerald-800 px-2.5 py-0.5 rounded border border-emerald-200">
            Active
          </span>
        </div>

        <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs">
          <div>
            <span className="font-bold text-slate-900 block">Demonstration Simulator Mode</span>
            <span className="text-slate-500 text-[11px]">
              Enables in-browser phone simulation without requiring active Twilio carrier minutes.
            </span>
          </div>
          <input
            type="checkbox"
            checked={demoMode}
            onChange={(e) => setDemoMode(e.target.checked)}
            className="w-4 h-4 text-teal-600 rounded"
          />
        </div>
      </div>
    </div>
  );
}
