
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Message, Sender, AppStep, UserRequest } from './types';
import { LOCATIONS, SERVICE_TYPES, ADMIN_PASSWORD, DISPATCHER_PHONE } from './constants';
import { MessageBubble } from './components/MessageBubble';
import { generateConfirmationMessage } from './services/geminiService';
import { getTargetId, setTargetId, getRequests, saveRequest } from './services/storageService';
import { Send, MapPin, CheckCircle, Phone, Loader2, PhoneCall, Wrench, User as UserIcon } from 'lucide-react';

const App: React.FC = () => {
  // State
  const [messages, setMessages] = useState<Message[]>([]);
  const [step, setStep] = useState<AppStep>(AppStep.WELCOME);
  const [userData, setUserData] = useState<UserRequest>({
    location: '',
    serviceType: '',
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
    }

    const initBot = async () => {
      // Check for 'bot' param in URL and clean it (remove @ if present)
      const searchParams = new URLSearchParams(window.location.search);
      let sourceBot = searchParams.get('bot') || 'default';
      sourceBot = sourceBot.replace('@', '');
      
      setUserData(prev => ({ ...prev, source: sourceBot }));

      setIsTyping(true);
      await new Promise(r => setTimeout(r, 1000));
      addMessage("Здравствуйте! Вы обратились в сервис по вскрытию дверей квартир, домов, автомобилей, сейфов. Ответьте на несколько вопросов и ожидайте звонка мастера.", Sender.BOT);
      
      await new Promise(r => setTimeout(r, 800));
      setIsTyping(false);
      setStep(AppStep.SELECT_LOCATION);
    };
    initBot();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- FLOW HANDLERS ---

  // Step 1: Location
  const handleLocationSelect = async (location: string) => {
    addMessage(location, Sender.USER);
    setUserData(prev => ({ ...prev, location }));
    
    setIsTyping(true);
    await new Promise(r => setTimeout(r, 600));
    
    addMessage("Что нужно вскрыть?", Sender.BOT);
    setIsTyping(false);
    setStep(AppStep.SELECT_SERVICE);
  };

  // Step 2: Service Type
  const handleServiceSelect = async (service: string) => {
    addMessage(service, Sender.USER);
    setUserData(prev => ({ ...prev, serviceType: service }));
    
    setIsTyping(true);
    await new Promise(r => setTimeout(r, 600));
    
    addMessage("Ваш номер телефона?", Sender.BOT);
    setIsTyping(false);
    setStep(AppStep.INPUT_PHONE);
  };

  // Step 3: Phone Input
  const handlePhoneSubmit = async () => {
    if (!inputValue.trim()) return;

    // Check for admin commands first
    if (inputValue.startsWith('/')) {
        addMessage(inputValue, Sender.USER);
        const command = inputValue;
        setInputValue('');
        processAdminCommand(command);
        return;
    }

    const phone = inputValue;
    addMessage(phone, Sender.USER);
    setUserData(prev => ({ ...prev, phone }));
    setInputValue('');
    
    setIsTyping(true);
    await new Promise(r => setTimeout(r, 600));
    
    addMessage("Как к вам обращаться?", Sender.BOT);
    setIsTyping(false);
    setStep(AppStep.INPUT_NAME);
  };

  // Step 4: Name Input & Final Submit
  const handleNameSubmit = async () => {
    if (!inputValue.trim()) return;

    const name = inputValue;
    addMessage(name, Sender.USER);
    setInputValue('');

    const finalData = {
        ...userData,
        name: name,
        requestTime: new Date().toLocaleString()
    };
    setUserData(finalData);

    setIsTyping(true);
    setStep(AppStep.PROCESSING);

    // Save locally
    saveRequest({
      id: Date.now().toString(),
      timestamp: Date.now(),
      location: finalData.location,
      serviceType: finalData.serviceType,
      name: finalData.name,
      phone: finalData.phone,
      source: finalData.source || 'default'
    });

    try {
        await sendTelegramNotification(finalData);
        
        // Final message
        const confirmationText = await generateConfirmationMessage(finalData);
        
        setIsTyping(false);
        addMessage(confirmationText, Sender.BOT);
        setStep(AppStep.COMPLETED);
    } catch (e) {
        console.error(e);
        setIsTyping(false);
        addMessage("Спасибо! Заявка принята.", Sender.BOT);
        setStep(AppStep.COMPLETED);
    }
  };


  // --- ADMIN & UTILS ---

  const handleStats = () => {
    const requests = getRequests();
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    
    const total = requests.length;
    const today = requests.filter(r => r.timestamp >= startOfDay).length;

    const sourceCounts: Record<string, number> = {};
    requests.forEach(r => {
        const src = r.source || 'Неизвестно';
        sourceCounts[src] = (sourceCounts[src] || 0) + 1;
    });

    let statsMsg = `📊 Статистика (ID: ${currentTargetId})\n` +
                     `Всего: ${total} | Сегодня: ${today}`;
    
    if (Object.keys(sourceCounts).length > 0) {
        statsMsg += `\n\n🤖 По ботам:\n`;
        Object.entries(sourceCounts).forEach(([name, count]) => {
            statsMsg += `@${name}: ${count}\n`;
        });
    }

    addMessage(statsMsg, Sender.BOT);
  };

  const handleSetId = (newId: string) => {
    if (newId) {
      setTargetId(newId);
      setCurrentTargetId(newId);
      addMessage(`✅ ID изменен на: ${newId}`, Sender.BOT);
    }
  };

  const processAdminCommand = (input: string) => {
    const parts = input.trim().split(' ');
    const command = parts[0];
    const password = parts[1];
    const arg = parts[2];

    if (password !== ADMIN_PASSWORD) {
       addMessage("⛔ Неверный пароль.", Sender.BOT);
       return;
    }
    if (command === '/stats') return handleStats();
    if (command === '/setid') return handleSetId(arg);
    addMessage("Неизвестная команда.", Sender.BOT);
  };

  // Phone Mask
  const formatPhoneNumber = (value: string) => {
    if (value.startsWith('/')) return value;
    const phoneNumber = value.replace(/\D/g, '');
    if (phoneNumber.length === 0) return '';
    let formatted = '';
    if (['7', '8', '9'].includes(phoneNumber[0])) {
        if (phoneNumber[0] === '9') formatted = '+7 (9';
        else formatted = '+7 (';
        if (phoneNumber.length > 1) formatted += phoneNumber.substring(1, 4);
        if (phoneNumber.length >= 5) formatted += ') ' + phoneNumber.substring(4, 7);
        if (phoneNumber.length >= 8) formatted += '-' + phoneNumber.substring(7, 9);
        if (phoneNumber.length >= 10) formatted += '-' + phoneNumber.substring(9, 11);
        return formatted;
    } 
    return '+' + phoneNumber;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      if (step === AppStep.INPUT_PHONE) {
         if (val.length < inputValue.length) { setInputValue(val); return; } // Allow delete
         if (val.startsWith('/')) { setInputValue(val); } 
         else { setInputValue(formatPhoneNumber(val)); }
      } else {
         setInputValue(val);
      }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (step === AppStep.INPUT_PHONE) handlePhoneSubmit();
      if (step === AppStep.INPUT_NAME) handleNameSubmit();
    }
  };

  const sendTelegramNotification = async (requestData: UserRequest) => {
      await fetch('/api/telegram', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
              targetId: currentTargetId,
              botId: requestData.source, 
              message: `🚨 <b>НОВАЯ ЗАЯВКА</b> 🚨\n\n` +
                       `🛠 <b>Услуга:</b> ${requestData.serviceType}\n` +
                       `📍 <b>Регион:</b> ${requestData.location}\n` +
                       `👤 <b>Имя:</b> ${requestData.name}\n` +
                       `📱 <b>Телефон:</b> ${requestData.phone}\n\n` +
                       `🤖 <b>Бот:</b> @${requestData.source}`
          })
      });
  };

  // --- RENDER INPUTS ---

  const renderInputArea = () => {
    // 1. Выбор локации
    if (step === AppStep.SELECT_LOCATION) {
      return (
        <div className="flex gap-2 w-full">
          {LOCATIONS.map((loc) => (
            <button 
              key={loc}
              onClick={() => handleLocationSelect(loc)}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-2 rounded-xl text-sm flex items-center justify-center gap-1 shadow-lg"
            >
              <MapPin size={16} /> {loc}
            </button>
          ))}
        </div>
      );
    }

    // 2. Выбор услуги
    if (step === AppStep.SELECT_SERVICE) {
      return (
        <div className="grid grid-cols-2 gap-2 w-full max-h-48 overflow-y-auto no-scrollbar">
          {SERVICE_TYPES.map((type) => (
            <button
              key={type}
              onClick={() => handleServiceSelect(type)}
              className="bg-white border border-blue-100 hover:bg-blue-50 text-blue-800 text-sm font-medium py-3 px-2 rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2"
            >
              <Wrench size={16} className="text-blue-500" /> {type}
            </button>
          ))}
        </div>
      );
    }

    // 3. Ввод телефона
    if (step === AppStep.INPUT_PHONE) {
      return (
        <div className="flex gap-2 w-full items-center">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
               <Phone className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="tel"
              value={inputValue}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="+7 (999) 000-00-00"
              className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
              autoFocus
            />
          </div>
          <button 
            onClick={handlePhoneSubmit}
            disabled={!inputValue.trim() || inputValue.length < 5}
            className="bg-blue-600 disabled:bg-gray-300 text-white p-3 rounded-xl shadow-lg"
          >
            <Send size={20} />
          </button>
        </div>
      );
    }

    // 4. Ввод имени
    if (step === AppStep.INPUT_NAME) {
        return (
          <div className="flex gap-2 w-full items-center">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                 <UserIcon className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                value={inputValue}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="Иван"
                className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                autoFocus
              />
            </div>
            <button 
              onClick={handleNameSubmit}
              disabled={!inputValue.trim()}
              className="bg-green-600 disabled:bg-gray-300 text-white p-3 rounded-xl shadow-lg"
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
          <span className="font-medium">Заявка отправлена</span>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="flex justify-center min-h-screen bg-slate-200">
      <div className="w-full max-w-md bg-gray-50 h-[100dvh] flex flex-col shadow-2xl relative overflow-hidden">
        
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between shadow-sm z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white">
                <Phone size={20} />
            </div>
            <div>
                <h1 className="font-bold text-gray-800 text-lg leading-tight">Вскрытие Замков</h1>
                <p className="text-xs text-green-600 font-medium flex items-center gap-1">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                Работаем 24/7
                </p>
            </div>
          </div>
          <a 
            href={`tel:${DISPATCHER_PHONE}`} 
            className="bg-green-500 hover:bg-green-600 text-white p-2 rounded-full shadow-md transition-colors"
          >
            <PhoneCall size={20} />
          </a>
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

        {/* Footer */}
        <footer className="bg-gray-100 border-t border-gray-200 p-4 pb-6 safe-area-bottom">
          {step === AppStep.PROCESSING ? (
             <div className="flex justify-center items-center gap-2 text-gray-500 py-2">
                <Loader2 className="animate-spin" /> Обработка...
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
