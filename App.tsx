
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Message, Sender, AppStep, UserRequest } from './types';
import { MOSCOW_DISTRICTS } from './constants';
import { MessageBubble } from './components/MessageBubble';
import { generateConfirmationMessage } from './services/geminiService';
import { getTargetId, setTargetId, getRequests, saveRequest } from './services/storageService';
import { Send, MapPin, CheckCircle, AlertTriangle, Phone, User, Loader2 } from 'lucide-react';

const App: React.FC = () => {
  // State
  const [messages, setMessages] = useState<Message[]>([]);
  const [step, setStep] = useState<AppStep>(AppStep.WELCOME);
  const [userData, setUserData] = useState<UserRequest>({
    isMoscow: false,
    district: '',
    name: '',
    phone: '',
    requestTime: '',
    source: 'default'
  });
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [currentTargetId, setCurrentTargetId] = useState(getTargetId());

  // Refs for scrolling
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom helper
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  // Add a message helper
  const addMessage = useCallback((text: string, sender: Sender, type: 'text' | 'options' | 'form' = 'text', options?: string[]) => {
    const newMessage: Message = {
      id: Date.now().toString(),
      text,
      sender,
      timestamp: new Date(),
      type,
      options
    };
    setMessages(prev => [...prev, newMessage]);
  }, []);

  // Initial greeting & URL Param Parsing
  useEffect(() => {
    // 1. Force HTTPS
    if (window.location.protocol === 'http:' && window.location.hostname !== 'localhost') {
        window.location.href = window.location.href.replace('http:', 'https:');
    }

    // 2. Init Telegram Web App
    const tg = (window as any).Telegram?.WebApp;
    if (tg) {
        tg.ready();
        tg.expand();
        // Optionally use tg.initDataUnsafe to get user info if needed
    }

    const initBot = async () => {
      // Check for 'bot' param in URL
      const searchParams = new URLSearchParams(window.location.search);
      const sourceBot = searchParams.get('bot') || 'default';
      setUserData(prev => ({ ...prev, source: sourceBot }));

      setIsTyping(true);
      await new Promise(r => setTimeout(r, 1000));
      addMessage("Здравствуйте! Я бот службы вскрытия замков и сейфов. Вам нужна помощь специалиста?", Sender.BOT);
      
      await new Promise(r => setTimeout(r, 500));
      setIsTyping(false);
      setStep(AppStep.CONFIRM_CITY);
    };
    initBot();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle User Actions
  const handleCityConfirm = async (isMoscow: boolean) => {
    addMessage(isMoscow ? "Да, я из Москвы" : "Нет, другой город", Sender.USER);
    
    setIsTyping(true);
    await new Promise(r => setTimeout(r, 800));
    
    if (isMoscow) {
      setUserData(prev => ({ ...prev, isMoscow: true }));
      addMessage("Отлично. Выберите, пожалуйста, ваш административный округ (район) Москвы:", Sender.BOT);
      setIsTyping(false);
      setStep(AppStep.SELECT_DISTRICT);
    } else {
      addMessage("К сожалению, в данный момент мы работаем только по Москве. Извините!", Sender.BOT);
      setIsTyping(false);
      setStep(AppStep.OUT_OF_AREA);
    }
  };

  const handleDistrictSelect = async (district: string) => {
    addMessage(district, Sender.USER);
    setUserData(prev => ({ ...prev, district }));
    
    setIsTyping(true);
    await new Promise(r => setTimeout(r, 800));
    
    addMessage(`Район ${district} принят. Пожалуйста, напишите Ваше Имя и Телефон в одном сообщении, чтобы ближайший мастер мог связаться с Вами.`, Sender.BOT);
    setIsTyping(false);
    setStep(AppStep.INPUT_CONTACT);
  };

  const handleStats = () => {
    const requests = getRequests();
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfYesterday = startOfDay - 86400000;
    const startOfWeek = now.getTime() - 7 * 24 * 60 * 60 * 1000;
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    const total = requests.length;
    const today = requests.filter(r => r.timestamp >= startOfDay).length;
    const yesterday = requests.filter(r => r.timestamp >= startOfYesterday && r.timestamp < startOfDay).length;
    const week = requests.filter(r => r.timestamp >= startOfWeek).length;
    const month = requests.filter(r => r.timestamp >= startOfMonth).length;

    // Calculate stats by source
    const sourceCounts: Record<string, number> = {};
    requests.forEach(r => {
        const src = r.source || 'Неизвестно';
        sourceCounts[src] = (sourceCounts[src] || 0) + 1;
    });

    let statsMsg = `📊 Статистика заявок (ID: ${currentTargetId}):\n\n` +
                     `🌍 Всего: ${total}\n` +
                     `🟢 Сегодня: ${today}\n` +
                     `🟡 Вчера: ${yesterday}\n` +
                     `🗓 За неделю: ${week}\n` +
                     `📅 За месяц: ${month}`;
    
    if (Object.keys(sourceCounts).length > 0) {
        statsMsg += `\n\n🤖 Источники (боты):\n`;
        Object.entries(sourceCounts).forEach(([name, count]) => {
            statsMsg += `• ${name}: ${count}\n`;
        });
    }

    addMessage(statsMsg, Sender.BOT);
  };

  const handleSetId = (cmd: string) => {
    const parts = cmd.trim().split(' ');
    if (parts.length > 1 && parts[1]) {
      const newId = parts[1];
      setTargetId(newId);
      setCurrentTargetId(newId);
      addMessage(`✅ Telegram ID для уведомлений успешно изменен на: ${newId}`, Sender.BOT);
    } else {
      addMessage(`⚠️ Ошибка формата. Используйте: /setid <новый_id>`, Sender.BOT);
    }
  };

  const sendTelegramNotification = async (requestData: UserRequest) => {
      try {
          const response = await fetch('/api/telegram', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  targetId: currentTargetId,
                  // Передаем имя бота (source), чтобы сервер знал, какой токен использовать
                  botId: requestData.source, 
                  message: `🚨 <b>НОВАЯ ЗАЯВКА</b> 🚨\n\n` +
                           `👤 <b>Имя:</b> ${requestData.name}\n` +
                           `📱 <b>Телефон:</b> ${requestData.phone}\n` +
                           `📍 <b>Район:</b> ${requestData.district}\n` +
                           `🤖 <b>Бот:</b> ${requestData.source}\n` +
                           `🕒 <b>Время:</b> ${requestData.requestTime}`
              })
          });
          if (!response.ok) throw new Error('Failed to send telegram message');
      } catch (e) {
          console.error("Failed to send notification via API", e);
      }
  };

  const handleContactSubmit = async () => {
    if (!inputValue.trim()) return;
    
    const contactInfo = inputValue;

    // Admin Commands Check
    if (contactInfo.startsWith('/')) {
      addMessage(contactInfo, Sender.USER);
      setInputValue('');
      
      if (contactInfo === '/stats') {
        handleStats();
        return;
      }
      if (contactInfo.startsWith('/setid')) {
        handleSetId(contactInfo);
        return;
      }

      addMessage("Неизвестная команда.", Sender.BOT);
      return;
    }

    setInputValue('');
    addMessage(contactInfo, Sender.USER);
    
    // Normal User Flow
    const name = contactInfo.split(' ')[0] || 'Клиент';
    const newUserData = { 
      ...userData, 
      name: name, 
      phone: contactInfo,
      requestTime: new Date().toLocaleString()
    };

    setUserData(newUserData);

    setIsTyping(true);
    setStep(AppStep.PROCESSING);

    // Save Request to Storage
    saveRequest({
      id: Date.now().toString(),
      timestamp: Date.now(),
      district: userData.district,
      name: name,
      phone: contactInfo,
      source: userData.source || 'default'
    });

    try {
      // 1. Send Real Telegram Notification via Serverless Function
      await sendTelegramNotification(newUserData);

      // 2. Use Gemini to generate a polite confirmation
      const confirmationText = await generateConfirmationMessage({
        ...newUserData
      });

      setIsTyping(false);
      addMessage(confirmationText, Sender.BOT);
      setStep(AppStep.COMPLETED);

    } catch (error) {
      console.error("Error processing request", error);
      setIsTyping(false);
      addMessage("Заявка принята! Мастер свяжется с вами в ближайшее время.", Sender.BOT);
      setStep(AppStep.COMPLETED);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleContactSubmit();
    }
  };

  // Render Input Area based on Step
  const renderInputArea = () => {
    if (step === AppStep.CONFIRM_CITY) {
      return (
        <div className="flex gap-2 w-full">
          <button 
            onClick={() => handleCityConfirm(true)}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg"
          >
            <MapPin size={18} /> Москва
          </button>
          <button 
            onClick={() => handleCityConfirm(false)}
            className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-3 px-4 rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm"
          >
            Другой город
          </button>
        </div>
      );
    }

    if (step === AppStep.SELECT_DISTRICT) {
      return (
        <div className="grid grid-cols-2 gap-2 w-full max-h-40 overflow-y-auto no-scrollbar">
          {MOSCOW_DISTRICTS.map((dist) => (
            <button
              key={dist}
              onClick={() => handleDistrictSelect(dist)}
              className="bg-white border border-blue-100 hover:bg-blue-50 text-blue-800 text-xs font-medium py-3 px-2 rounded-lg shadow-sm transition-colors truncate"
            >
              {dist}
            </button>
          ))}
        </div>
      );
    }

    if (step === AppStep.INPUT_CONTACT) {
      return (
        <div className="flex gap-2 w-full items-center">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
               <User className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Имя и телефон..."
              className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-xl leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm shadow-sm"
              autoFocus
            />
          </div>
          <button 
            onClick={handleContactSubmit}
            disabled={!inputValue.trim()}
            className="bg-blue-600 disabled:bg-blue-300 hover:bg-blue-700 text-white p-3 rounded-xl shadow-lg transition-all"
          >
            <Send size={20} />
          </button>
        </div>
      );
    }

    if (step === AppStep.COMPLETED) {
      return (
        <div className="w-full bg-green-100 text-green-800 p-3 rounded-xl flex items-center justify-center gap-2 border border-green-200">
          <CheckCircle size={20} />
          <span className="font-medium">Заявка отправлена (ID: {currentTargetId})</span>
        </div>
      );
    }

    if (step === AppStep.OUT_OF_AREA) {
        return (
            <div className="w-full bg-red-100 text-red-800 p-3 rounded-xl flex items-center justify-center gap-2 border border-red-200">
              <AlertTriangle size={20} />
              <span className="font-medium">Обслуживание невозможно</span>
            </div>
          );
    }

    return null;
  };

  return (
    <div className="flex justify-center min-h-screen bg-slate-200">
      {/* Mobile Container */}
      <div className="w-full max-w-md bg-gray-50 h-[100dvh] flex flex-col shadow-2xl relative overflow-hidden">
        
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 shadow-sm z-10">
          <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white">
            <Phone size={20} />
          </div>
          <div>
            <h1 className="font-bold text-gray-800 text-lg leading-tight">Вскрытие Замков</h1>
            <p className="text-xs text-green-600 font-medium flex items-center gap-1">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              Онлайн • Москва
            </p>
          </div>
        </header>

        {/* Chat Area */}
        <main className="flex-1 overflow-y-auto p-4 space-y-4 bg-[url('https://www.transparenttextures.com/patterns/subtle-white-feathers.png')]">
          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}
          
          {isTyping && (
            <div className="flex w-full mb-4 justify-start">
              <div className="flex max-w-[80%] flex-row items-end gap-2">
                <div className="bg-white p-3 rounded-2xl rounded-bl-none shadow-sm">
                    <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                    </div>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </main>

        {/* Action Area (Sticky Bottom) */}
        <footer className="bg-gray-100 border-t border-gray-200 p-4 pb-6 safe-area-bottom">
          {step === AppStep.PROCESSING ? (
             <div className="flex justify-center items-center gap-2 text-gray-500 py-2">
                <Loader2 className="animate-spin" /> Обработка заявки...
             </div>
          ) : (
             renderInputArea()
          )}
        </footer>
      </div>
    </div>
  );
};

export default App;
