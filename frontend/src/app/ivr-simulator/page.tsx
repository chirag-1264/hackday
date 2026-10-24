'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  Phone,
  PhoneCall,
  PhoneOff,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Sparkles,
  Code,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Send,
  Headphones,
  ShieldCheck,
  Calendar,
  Clock,
  ArrowRight,
  ChevronDown,
  LayoutDashboard,
} from 'lucide-react';
import { simulateIVRTurn, fetchAIStatus } from '@/lib/api';
import { IVRSimulateResponse, AIStatus } from '@/lib/types';

interface Message {
  id: string;
  sender: 'caller' | 'assistant' | 'system';
  text: string;
  time: string;
}

export default function IVRSimulatorPage() {
  const [callActive, setCallActive] = useState<boolean>(false);
  const [callDuration, setCallDuration] = useState<number>(0);
  const [sessionId, setSessionId] = useState<string>('');
  const [currentStep, setCurrentStep] = useState<string>('welcome');
  const [language, setLanguage] = useState<'en' | 'hi'>('en');

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [speechEnabled, setSpeechEnabled] = useState<boolean>(true);
  const [isListening, setIsListening] = useState<boolean>(false);

  // Inspection states
  const [lastResponse, setLastResponse] = useState<IVRSimulateResponse | null>(null);
  const [twimlViewOpen, setTwimlViewOpen] = useState<boolean>(false);
  const [gemmaViewOpen, setGemmaViewOpen] = useState<boolean>(true);
  const [aiStatus, setAiStatus] = useState<AIStatus | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const durationTimerRef = useRef<any>(null);

  useEffect(() => {
    fetchAIStatus().then(setAiStatus).catch(console.error);
  }, []);

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Call timer
  useEffect(() => {
    if (callActive) {
      durationTimerRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (durationTimerRef.current) clearInterval(durationTimerRef.current);
      setCallDuration(0);
    }
    return () => {
      if (durationTimerRef.current) clearInterval(durationTimerRef.current);
    };
  }, [callActive]);

  // Speak text using Web Speech API
  const speakVoice = (text: string, lang: 'en' | 'hi') => {
    if (!speechEnabled || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang === 'hi' ? 'hi-IN' : 'en-IN';
      utterance.rate = 0.95;
      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.warn('Speech synthesis unavailable', err);
    }
  };

  // Start call
  const handleStartCall = async (initialLang: 'en' | 'hi' = 'en') => {
    const newSessionId = `ivr-sim-${Date.now()}`;
    setSessionId(newSessionId);
    setCallActive(true);
    setLanguage(initialLang);
    setMessages([]);
    setCurrentStep('welcome');
    setLastResponse(null);

    const initialBotText =
      initialLang === 'hi'
        ? 'Namaste! SwasthyaCall mein aapka swagat hai. Main aapka AI healthcare assistant hoon. Kripya batayein aap kis doctor ya bimari ke liye appointment chahte hain?'
        : 'Namaste and welcome to SwasthyaCall. I am your automated AI healthcare assistant. Please tell me which specialty or symptom you need care for, and your preferred date.';

    const welcomeMsg: Message = {
      id: '1',
      sender: 'assistant',
      text: initialBotText,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages([welcomeMsg]);
    speakVoice(initialBotText, initialLang);

    // Initial simulation turn with welcome digit
    try {
      setLoading(true);
      const res = await simulateIVRTurn({
        session_id: newSessionId,
        user_input: initialLang === 'hi' ? '2' : '1',
        language: initialLang,
      });
      setLastResponse(res);
      setCurrentStep(res.step);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // End call
  const handleEndCall = () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setCallActive(false);
    setMessages((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        sender: 'system',
        text: 'Call disconnected by user.',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  };

  // Send turn
  const handleSendTurn = async (textToSend?: string) => {
    const userText = (textToSend || inputText).trim();
    if (!userText || !callActive) return;

    setInputText('');
    const newMsg: Message = {
      id: String(Date.now()),
      sender: 'caller',
      text: userText,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages((prev) => [...prev, newMsg]);

    try {
      setLoading(true);
      const res = await simulateIVRTurn({
        session_id: sessionId,
        user_input: userText,
        language,
      });
      setLastResponse(res);
      setCurrentStep(res.step);

      const botMsg: Message = {
        id: String(Date.now() + 1),
        sender: 'assistant',
        text: res.bot_response,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, botMsg]);
      speakVoice(res.bot_response, language);

      if (res.is_emergency) {
        // Red flag emergency auto-hangup
        setTimeout(() => {
          handleEndCall();
        }, 6000);
      }
    } catch (err: any) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        {
          id: String(Date.now() + 2),
          sender: 'system',
          text: 'Error processing speech input: ' + err.message,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Browser speech recognition (Speech-to-Text)
  const handleToggleMic = () => {
    if (typeof window === 'undefined') return;
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert('Speech recognition is not supported in this browser. You can type your request directly!');
      return;
    }

    if (isListening) {
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = language === 'hi' ? 'hi-IN' : 'en-IN';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);
      recognition.onerror = () => setIsListening(false);

      recognition.onresult = (event: any) => {
        const spoken = event.results[0][0].transcript;
        if (spoken) {
          handleSendTurn(spoken);
        }
      };

      recognition.start();
    } catch (err) {
      console.error('Speech recognition error', err);
      setIsListening(false);
    }
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
              <Sparkles className="w-3.5 h-3.5 text-purple-600" />
              <span>Interactive Telephony Simulator</span>
            </div>
            {aiStatus && (
              <div
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold border ${
                  aiStatus.is_online
                    ? 'bg-purple-100 text-purple-900 border-purple-300'
                    : 'bg-slate-100 text-slate-800 border-slate-300'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    aiStatus.is_online ? 'bg-purple-600 animate-pulse' : 'bg-slate-500'
                  }`}
                ></span>
                <span>
                  Active Model: <strong>{aiStatus.provider.toUpperCase()}</strong> •{' '}
                  <code className="text-[11px] font-mono">{aiStatus.model_name}</code> ({aiStatus.mode})
                </span>
              </div>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            AI Telephone IVR Simulator
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-2xl">
            Experience the voice-first booking workflow used by phone callers. Speak or type in Hindi or English to test real-time intent extraction, slot querying, and atomic booking.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 transition shadow-sm"
          >
            <LayoutDashboard className="w-4 h-4 text-teal-600" />
            <span>Open Clinic Dashboard</span>
          </Link>
        </div>
      </div>

      {/* Simulator Workspace Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Phone Simulator Screen */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden flex flex-col h-[680px]">
          {/* Phone Top Status Bar */}
          <div className="bg-slate-900 text-white px-5 py-3 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="font-semibold">SwasthyaCall Voice Line</span>
              <span className="text-[10px] text-slate-400 font-mono">(Toll-Free 1800-DEMO)</span>
            </div>
            <div className="flex items-center gap-4 text-slate-300">
              <button
                onClick={() => setSpeechEnabled(!speechEnabled)}
                className="hover:text-white transition"
                title={speechEnabled ? 'Mute AI Voice' : 'Unmute AI Voice'}
              >
                {speechEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4 text-rose-400" />}
              </button>
              {callActive && <span className="font-mono text-emerald-400 font-bold">{formatTimer(callDuration)}</span>}
            </div>
          </div>

          {/* Call Active Indicator / Dial Screen */}
          {!callActive ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-6 bg-gradient-to-b from-slate-50 to-white">
              <div className="w-20 h-20 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center shadow-lg ring-8 ring-teal-50">
                <PhoneCall className="w-10 h-10" />
              </div>

              <div className="space-y-2 max-w-sm">
                <h3 className="text-xl font-bold text-slate-900">Start an AI Phone Call</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Choose your preferred caller language to simulate an inbound phone call to the healthcare helpline.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs">
                <button
                  onClick={() => handleStartCall('en')}
                  className="flex-1 py-3 px-4 rounded-xl text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 shadow-md transition flex items-center justify-center gap-2"
                >
                  <Phone className="w-4 h-4" />
                  <span>Call in English</span>
                </button>
                <button
                  onClick={() => handleStartCall('hi')}
                  className="flex-1 py-3 px-4 rounded-xl text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 shadow-md transition flex items-center justify-center gap-2"
                >
                  <Phone className="w-4 h-4" />
                  <span>Call in Hindi (हिंदी)</span>
                </button>
              </div>

              <div className="text-[11px] text-slate-700 bg-slate-100 px-3.5 py-2 rounded-xl border border-slate-200 flex items-center justify-between w-full max-w-sm">
                <span className="flex items-center gap-1.5">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      aiStatus?.is_online ? 'bg-purple-500 animate-pulse' : 'bg-emerald-500'
                    }`}
                  ></span>
                  <span>
                    Backend Model:{' '}
                    <strong>
                      {aiStatus ? `${aiStatus.provider.toUpperCase()} (${aiStatus.model_name})` : 'Loading...'}
                    </strong>
                  </span>
                </span>
                <span className="text-[10px] text-slate-500 uppercase font-semibold">
                  {aiStatus?.is_online ? 'Hosted Cloud NLU' : 'Local Engine'}
                </span>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col justify-between overflow-hidden">
              {/* Messages Dialogue Feed */}
              <div className="flex-1 p-5 overflow-y-auto space-y-3.5 bg-slate-50/60">
                {messages.map((msg) => {
                  if (msg.sender === 'system') {
                    return (
                      <div key={msg.id} className="text-center my-2">
                        <span className="text-[11px] font-medium bg-slate-200/80 text-slate-700 px-3 py-1 rounded-full">
                          {msg.text}
                        </span>
                      </div>
                    );
                  }

                  const isCaller = msg.sender === 'caller';
                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isCaller ? 'items-end' : 'items-start'}`}
                    >
                      <div className="text-[10px] text-slate-400 font-semibold mb-1 px-1">
                        {isCaller ? 'You (Caller)' : 'SwasthyaCall Assistant'} • {msg.time}
                      </div>
                      <div
                        className={`p-3.5 rounded-2xl max-w-[85%] text-xs leading-relaxed shadow-sm ${
                          isCaller
                            ? 'bg-teal-600 text-white rounded-br-none'
                            : 'bg-white text-slate-800 border border-slate-200 rounded-bl-none'
                        }`}
                      >
                        {msg.text}
                      </div>
                    </div>
                  );
                })}
                {loading && (
                  <div className="flex items-center gap-2 text-xs text-slate-400 p-2">
                    <Sparkles className="w-3.5 h-3.5 text-purple-600 animate-spin" />
                    <span>Gemma 4 is processing caller speech...</span>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Quick Reply Suggestions */}
              {lastResponse?.options && lastResponse.options.length > 0 && (
                <div className="px-4 py-2 bg-slate-100/80 border-t border-slate-200 flex flex-wrap gap-1.5 text-xs">
                  <span className="text-[10px] uppercase font-bold text-slate-400 py-1">Quick DTMF/Voice:</span>
                  {lastResponse.options.map((opt, i) => (
                    <button
                      key={i}
                      onClick={() => handleSendTurn(opt.split(' (')[0])}
                      className="px-2.5 py-1 rounded-md text-xs font-semibold bg-white hover:bg-teal-50 text-slate-700 border border-slate-200 transition"
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              )}

              {/* Input Control Bar */}
              <div className="p-3 bg-white border-t border-slate-200 flex items-center gap-2">
                <button
                  onClick={handleEndCall}
                  className="p-2.5 rounded-xl bg-rose-100 text-rose-700 hover:bg-rose-200 transition"
                  title="Hang Up Call"
                >
                  <PhoneOff className="w-5 h-5" />
                </button>

                <button
                  onClick={handleToggleMic}
                  className={`p-2.5 rounded-xl transition ${
                    isListening
                      ? 'bg-rose-600 text-white animate-pulse'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                  title={isListening ? 'Listening... click to stop' : 'Speak via Microphone'}
                >
                  {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                </button>

                <input
                  type="text"
                  placeholder={
                    language === 'hi'
                      ? 'Yahan type karein ya mic dabakar bole...'
                      : 'Type speech or click mic to talk...'
                  }
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSendTurn();
                  }}
                  className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600"
                />

                <button
                  disabled={loading || !inputText.trim()}
                  onClick={() => handleSendTurn()}
                  className="p-2.5 rounded-xl bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50 transition"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Gemma 4 Inspection and Twilio TwiML Output */}
        <div className="lg:col-span-5 space-y-4">
          {/* Gemma 4 NLU Live Inspection Panel */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-md p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-xs sm:text-sm">
                    {aiStatus ? `${aiStatus.provider.toUpperCase()} • ${aiStatus.model_name}` : 'Gemma 4 Structured NLU'}
                  </h3>
                  <span className="text-[10px] text-purple-700 font-mono">
                    Mode: {aiStatus?.mode || 'loading'} • {aiStatus?.is_online ? 'Hosted Cloud API' : 'Local Engine'}
                  </span>
                </div>
              </div>
              <span
                className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${
                  aiStatus?.is_online
                    ? 'bg-purple-50 text-purple-800 border-purple-200'
                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                }`}
              >
                {aiStatus?.is_online ? 'Hosted Adapter' : 'Local Adapter'}
              </span>
            </div>

            {lastResponse ? (
              <div className="space-y-3 text-xs">
                {/* Clear Error Alert if hosted model failed */}
                {lastResponse.error && (
                  <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-300 text-rose-900 text-xs space-y-1">
                    <div className="flex items-center gap-1.5 font-bold">
                      <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                      <span>Hosted Model Error</span>
                    </div>
                    <p className="text-[11px] leading-relaxed font-mono">{lastResponse.error}</p>
                    <Link
                      href="/dashboard/settings"
                      className="inline-flex items-center gap-1 text-rose-700 underline font-semibold text-[11px] pt-1"
                    >
                      <span>Check API Key and Model ID in Settings</span>
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                )}

                {/* Emergency Flag Callout */}
                {lastResponse.is_emergency && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-300 text-rose-900 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <strong className="block">Red-Flag Emergency Escalation:</strong>
                      <p className="text-[11px]">{lastResponse.bot_response}</p>
                    </div>
                  </div>
                )}

                {/* Intent & Entities Grid */}
                <div className="grid grid-cols-2 gap-2 font-mono text-[11px]">
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 col-span-2">
                    <span className="text-[10px] text-slate-400 block">Active Model Adapter:</span>
                    <strong className="text-purple-900">
                      {lastResponse.model_version || (aiStatus ? `${aiStatus.provider.toUpperCase()}: ${aiStatus.model_name}` : 'Loading...')}
                    </strong>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    <span className="text-[10px] text-slate-400 block">Detected Intent:</span>
                    <strong className="text-purple-900">{lastResponse.detected_intent || 'None'}</strong>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    <span className="text-[10px] text-slate-400 block">Current Step:</span>
                    <strong className="text-slate-800">{lastResponse.step}</strong>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    <span className="text-[10px] text-slate-400 block">Extracted Specialty:</span>
                    <strong className="text-slate-800 capitalize">
                      {lastResponse.extracted_entities.specialty?.replace('_', ' ') || 'None'}
                    </strong>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    <span className="text-[10px] text-slate-400 block">Target Date:</span>
                    <strong className="text-slate-800">
                      {lastResponse.extracted_entities.preferred_date || 'Not specified'}
                    </strong>
                  </div>
                </div>

                {/* Booking Committed Success Alert */}
                {lastResponse.appointment_created && (
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-950 space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-xs text-emerald-800">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>IVR Appointment Written to Database!</span>
                    </div>
                    <div className="text-[11px] font-mono space-y-0.5 pt-1 text-slate-700">
                      <div>Ref: <strong>{lastResponse.appointment_created.reference}</strong></div>
                      <div>Source: <strong className="uppercase">{lastResponse.appointment_created.booking_source}</strong></div>
                      <div>Time: <strong>{lastResponse.appointment_created.appointment_date} at {lastResponse.appointment_created.start_time}</strong></div>
                    </div>
                    <Link
                      href="/dashboard/appointments"
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:underline pt-1"
                    >
                      <span>Check in Live Clinic Dashboard</span>
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-slate-400 space-y-1">
                <Headphones className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p>Start a simulated phone call to observe real-time Gemma 4 JSON entity parsing.</p>
              </div>
            )}
          </div>

          {/* Twilio TwiML XML Preview Panel */}
          <div className="bg-slate-900 rounded-2xl text-slate-300 shadow-md p-5 space-y-3 font-mono text-xs">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2 text-slate-200">
                <Code className="w-4 h-4 text-teal-400" />
                <span className="font-semibold text-xs">Twilio Voice TwiML XML Output</span>
              </div>
              <span className="text-[10px] text-teal-400 bg-teal-950/80 px-2 py-0.5 rounded border border-teal-800">
                Telephony Webhook
              </span>
            </div>

            {lastResponse?.twiml_preview ? (
              <pre className="p-3 bg-black/40 rounded-xl overflow-x-auto text-[11px] text-emerald-400 leading-tight">
                {lastResponse.twiml_preview}
              </pre>
            ) : (
              <p className="text-[11px] text-slate-500 py-3">
                &lt;Response&gt;&lt;Say&gt;TwiML payload will be generated on incoming calls&lt;/Say&gt;&lt;/Response&gt;
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
