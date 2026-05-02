import { useState, useRef, useEffect, useCallback } from 'react';
import { charactersApi } from '../api/client';
import { Loader2, XIcon } from './Icons';
import { resolveFileUrl } from '../utils/resolveFileUrl';
import { ResolvedImg } from './Resolved';

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

function MicIcon({ className }) {
  return (
    <svg className={className || 'w-6 h-6'} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}

function SendIcon({ className }) {
  return (
    <svg className={className || 'w-5 h-5'} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

function VolumeIcon({ className }) {
  return (
    <svg className={className || 'w-4 h-4'} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
    </svg>
  );
}

export default function CharacterChat({ bookId, character, avatarUrl, onClose, onAvatarClick }) {
  const [sessionId, setSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [listening, setListening] = useState(false);
  const [interimText, setInterimText] = useState('');
  const [playingId, setPlayingId] = useState(null);
  const [error, setError] = useState('');

  const messagesEndRef = useRef(null);
  const audioRef = useRef(new Audio());
  const recognitionRef = useRef(null);
  const inputRef = useRef(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await charactersApi.startChat(bookId, character.name);
        if (cancelled) return;
        const sid = r.data.session_id;
        setSessionId(sid);
        setMessages([{
          id: 'greeting',
          role: 'assistant',
          content: r.data.greeting,
          audioUrl: null,
        }]);
        setLoading(false);

        // Poll for greeting audio in background
        for (let i = 0; i < 10; i++) {
          await new Promise((res) => setTimeout(res, 1500));
          if (cancelled) return;
          try {
            const ar = await charactersApi.getGreetingAudio(bookId, sid);
            const url = ar.data?.greeting_audio_url;
            if (url) {
              setMessages((prev) => prev.map((m) =>
                m.id === 'greeting' ? { ...m, audioUrl: url } : m
              ));
              playAudio(url, 'greeting');
              break;
            }
          } catch { break; }
        }
      } catch (e) {
        if (!cancelled) {
          setError(e.response?.data?.detail || e.message || '初始化对话失败');
          setLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [bookId, character.name]);

  useEffect(() => {
    return () => {
      audioRef.current.pause();
      audioRef.current.src = '';
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch {}
      }
    };
  }, []);

  const playAudio = (url, msgId) => {
    const audio = audioRef.current;
    audio.pause();
    (async () => {
      audio.src = await resolveFileUrl(url);
      audio.onplay = () => setPlayingId(msgId);
      audio.onended = () => setPlayingId(null);
      audio.onerror = () => setPlayingId(null);
      audio.play().catch(() => setPlayingId(null));
    })();
  };

  const handleSend = async (text) => {
    const msg = (text || inputText).trim();
    if (!msg || !sessionId || sending) return;

    setInputText('');
    const userMsg = { id: `u-${Date.now()}`, role: 'user', content: msg };
    setMessages((prev) => [...prev, userMsg]);
    setSending(true);
    setError('');

    try {
      const r = await charactersApi.sendMessage(bookId, sessionId, msg);
      const aiMsg = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: r.data.response,
        audioUrl: r.data.audio_url,
      };
      setMessages((prev) => [...prev, aiMsg]);
      if (r.data.audio_url) {
        playAudio(r.data.audio_url, aiMsg.id);
      }
    } catch (e) {
      setError(e.response?.data?.detail || e.message || '发送失败');
    } finally {
      setSending(false);
    }
  };

  const toggleListening = () => {
    if (!SpeechRecognition) {
      setError('当前浏览器不支持语音识别，请使用 Chrome');
      return;
    }

    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'zh-CN';
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      let final = '';
      let interim = '';
      for (let i = 0; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += transcript;
        } else {
          interim += transcript;
        }
      }
      if (final) {
        setInterimText('');
        setInputText(final);
        handleSend(final);
      } else {
        setInterimText(interim);
      }
    };

    recognition.onend = () => {
      setListening(false);
      setInterimText('');
    };

    recognition.onerror = (e) => {
      if (e.error !== 'no-speech') {
        setError(`语音识别错误: ${e.error}`);
      }
      setListening(false);
      setInterimText('');
    };

    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-2xl flex items-center justify-center p-4" onClick={onClose}>
        <div className="bg-[#1D1D1F]/90 backdrop-blur-3xl rounded-[32px] p-10 flex flex-col items-center gap-5 shadow-[0_32px_96px_rgba(0,0,0,0.5)] border border-white/10" onClick={(e) => e.stopPropagation()}>
          <Loader2 className="w-12 h-12 text-[#0071E3] animate-spin" />
          <p className="text-white font-black tracking-tight text-[18px]">正在唤醒 {character.name}...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-2xl flex items-center justify-center p-4 sm:p-8" onClick={onClose}>
      <div
        className="bg-[#1D1D1F]/95 backdrop-blur-3xl rounded-[40px] shadow-[0_32px_96px_rgba(0,0,0,0.5)] flex flex-col w-full max-w-2xl overflow-hidden border border-white/10"
        style={{ height: 'min(800px, 90vh)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 sm:px-8 py-5 bg-[#1D1D1F]/80 backdrop-blur-2xl border-b border-white/10 flex-shrink-0 z-10">
          <div className="flex items-center gap-4">
            <div
              className="relative group cursor-pointer"
              onClick={onAvatarClick}
              title="点击重新框选头像"
            >
              {avatarUrl ? (
                <ResolvedImg src={avatarUrl} alt={character.name} className="w-14 h-14 rounded-full object-cover border-[3px] border-white/20 group-hover:border-white transition-all duration-300 shadow-sm group-hover:shadow-[0_8px_24px_rgba(255,255,255,0.15)] group-hover:scale-105" />
              ) : (
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#AF52DE] to-[#FF2D55] flex items-center justify-center text-white font-black text-[24px] group-hover:scale-105 transition-all duration-300 shadow-sm group-hover:shadow-[0_8px_24px_rgba(175,82,222,0.3)]">
                  {character.name[0]}
                </div>
              )}
              <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-[#34C759] border-[3px] border-[#1D1D1F] rounded-full shadow-sm" />
              <div className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center backdrop-blur-sm">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            </div>
            <div className="pt-1">
              <h2 className="text-white font-black tracking-tight text-[18px] mb-1">{character.name}</h2>
              <p className="text-[#86868B] font-bold text-[13px] line-clamp-1 tracking-tight flex items-center gap-1.5">
                {character.personality || character.description || '课程角色'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-[#86868B] hover:text-white p-3 rounded-full hover:bg-white/10 transition-all active:scale-[0.95]">
            <XIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 sm:px-8 py-8 space-y-6 min-h-0 thin-scroll">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`flex items-end gap-4 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                {msg.role === 'assistant' && (
                  <div className="flex-shrink-0">
                    {avatarUrl ? (
                      <ResolvedImg src={avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover border-2 border-white/20 shadow-sm" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#AF52DE] to-[#FF2D55] flex items-center justify-center text-white text-[16px] font-black shadow-sm">
                        {character.name[0]}
                      </div>
                    )}
                  </div>
                )}
                <div className={`rounded-[24px] px-5 py-4 shadow-sm ${
                  msg.role === 'user'
                    ? 'bg-[#0071E3] text-white rounded-br-[8px] shadow-[0_4px_16px_rgba(0,113,227,0.2)]'
                    : 'bg-white/10 text-white/95 rounded-bl-[8px] border border-white/10 backdrop-blur-md'
                }`}>
                  <p className="text-[16px] font-medium leading-relaxed tracking-tight whitespace-pre-wrap">{msg.content}</p>
                  {msg.audioUrl && msg.role === 'assistant' && (
                    <button
                      onClick={() => playAudio(msg.audioUrl, msg.id)}
                      className={`mt-3 flex items-center gap-2 text-[13px] font-bold tracking-tight transition-all duration-300 active:scale-[0.95] bg-black/20 hover:bg-black/40 px-4 py-2 rounded-full border border-white/10 ${
                        playingId === msg.id ? 'text-[#34C759] border-[#34C759]/30 bg-[#34C759]/10' : 'text-white/80 hover:text-white'
                      }`}
                    >
                      <VolumeIcon className="w-4 h-4" />
                      {playingId === msg.id ? '播放中...' : '播放语音'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}

          {sending && (
            <div className="flex justify-start">
              <div className="flex items-end gap-4">
                {avatarUrl ? (
                  <ResolvedImg src={avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover border-2 border-white/20 shadow-sm" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#AF52DE] to-[#FF2D55] flex items-center justify-center text-white text-[16px] font-black shadow-sm">
                    {character.name[0]}
                  </div>
                )}
                <div className="bg-white/10 border border-white/10 backdrop-blur-md rounded-[24px] rounded-bl-[8px] px-5 py-4 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="flex gap-1.5">
                      <span className="w-2 h-2 bg-[#86868B] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 bg-[#86868B] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 bg-[#86868B] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                    <span className="text-[#86868B] text-[14px] font-bold tracking-tight">思考中...</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {interimText && (
            <div className="flex justify-center mt-4">
              <div className="bg-white/10 border border-white/10 backdrop-blur-md shadow-sm rounded-full px-6 py-3">
                <p className="text-white/70 text-[14px] font-bold tracking-tight italic">{interimText}...</p>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} className="h-4" />
        </div>

        {error && (
          <div className="mx-6 sm:mx-8 mb-4 bg-[#FF3B30]/10 border border-[#FF3B30]/20 rounded-[16px] px-5 py-4 text-[#FF3B30] text-[14px] font-bold tracking-tight flex items-center justify-between flex-shrink-0 shadow-sm backdrop-blur-md">
            <span>{error}</span>
            <button onClick={() => setError('')} className="ml-4 text-[#FF3B30] hover:text-white p-1.5 rounded-full hover:bg-[#FF3B30] transition-all active:scale-[0.95]">✕</button>
          </div>
        )}

        {/* Input area */}
        <div className="px-6 sm:px-8 pb-6 sm:pb-8 pt-5 border-t border-white/10 flex-shrink-0 bg-[#1D1D1F]/80 backdrop-blur-2xl z-10">
          <div className="flex items-center gap-4">
            <button
              onClick={toggleListening}
              disabled={sending}
              className={`flex-shrink-0 w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 shadow-sm active:scale-[0.95] border ${
                listening
                  ? 'bg-[#FF3B30] text-white border-transparent shadow-[0_8px_24px_rgba(255,59,48,0.4)] scale-[1.05] animate-pulse'
                  : 'bg-white/10 text-white/70 hover:bg-white/20 hover:text-white border-white/10 hover:border-white/20'
              }`}
            >
              <MicIcon className="w-6 h-6" />
            </button>

            <input
              ref={inputRef}
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={listening ? '正在听...' : `说点什么...`}
              disabled={sending || listening}
              className="flex-1 min-w-0 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full px-6 py-4 text-white text-[16px] font-medium tracking-tight placeholder-white/40 focus:outline-none focus:ring-[4px] focus:ring-[#0071E3]/30 focus:border-[#0071E3] disabled:opacity-50 transition-all duration-300 shadow-inner"
            />

            <button
              onClick={() => handleSend()}
              disabled={!inputText.trim() || sending || listening}
              className="flex-shrink-0 w-14 h-14 rounded-full bg-[#0071E3] hover:bg-[#0077ED] hover:scale-105 disabled:bg-white/10 disabled:text-white/40 disabled:scale-100 disabled:shadow-none text-white flex items-center justify-center transition-all duration-300 shadow-[0_8px_24px_rgba(0,113,227,0.3)] active:scale-[0.95]"
            >
              {sending ? <Loader2 className="w-6 h-6 animate-spin" /> : <SendIcon className="w-6 h-6 ml-0.5" />}
            </button>
          </div>

          {listening && (
            <p className="text-center text-[#FF3B30] font-bold tracking-tight text-[13px] mt-4 animate-pulse">
              正在录音，说完自动发送
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
