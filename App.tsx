
import React, { useState, useEffect } from 'react';
import { AppStep, UserRequest } from './types';
import { ADMIN_PASSWORD, DISPATCHER_PHONE, DISPATCHER_PHONE_DISPLAY } from './constants';
import { getTargetId, setTargetId, getRequests, saveRequest } from './services/storageService';
import { Phone, CheckCircle, ArrowLeft, Send, MapPin, User, PhoneCall, FileText, ShieldAlert } from 'lucide-react';

const App: React.FC = () => {
  // --- STATE ---
  const [step, setStep] = useState<AppStep>(AppStep.MENU);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  // Data State
  const [formData, setFormData] = useState<UserRequest>({
    name: '',
    phone: '',
    metro: '',
    source: 'default',
    telegramUser: ''
  });

  // Admin / Target
  const [currentTargetId, setCurrentTargetId] = useState(getTargetId());

  // --- INITIALIZATION ---
  useEffect(() => {
    // 1. Force HTTPS
    if (window.location.protocol === 'http:' && window.location.hostname !== 'localhost') {
        window.location.href = window.location.href.replace('http:', 'https:');
    }

    // 2. Parse URL Params (Source Bot)
    const searchParams = new URLSearchParams(window.location.search);
    let sourceBot = searchParams.get('bot') || 'default';
    sourceBot = sourceBot.replace('@', '');

    // 3. Init Telegram Web App & Get User
    let tgUserStr = '';
    const tg = (window as any).Telegram?.WebApp;
    if (tg) {
        tg.ready();
        tg.expand();
        const user = tg.initDataUnsafe?.user;
        if (user) {
            const username = user.username ? `@${user.username}` : '';
            tgUserStr = `${user.first_name} ${user.last_name || ''} ${username}`.trim();
        }
    }

    setFormData(prev => ({ 
        ...prev, 
        source: sourceBot,
        telegramUser: tgUserStr
    }));
  }, []);


  // --- LOGIC: CALL OPERATOR ---
  const handleCallOperator = async () => {
    // 1. Отправляем уведомление в канал, что человек нажал кнопку
    setIsLoading(true);
    try {
        const msg = `🔔 <b>НАЖАЛИ КНОПКУ ЗВОНКА</b>\n\n` +
                    `👤 <b>TG Пользователь:</b> ${formData.telegramUser || 'Не определен'}\n` +
                    `🤖 <b>Бот:</b> @${formData.source}`;
        
        // Отправляем "тихо", не блокируем интерфейс надолго
        sendTelegramMessage(msg).catch(console.error);
        
    } finally {
        setIsLoading(false);
        // 2. Открываем набор номера
        window.location.href = `tel:${DISPATCHER_PHONE}`;
    }
  };


  // --- LOGIC: SUBMIT FORM ---
  const handleSubmitForm = async () => {
    if (!formData.name.trim() || !formData.phone.trim() || formData.phone.length < 16) {
        setErrorMsg('Заполните Имя и корректный Телефон');
        return;
    }
    
    // Check for admin command in Name field
    if (formData.name.startsWith('/')) {
        processAdminCommand(formData.name);
        return;
    }

    setIsLoading(true);
    setErrorMsg('');

    // Save locally for stats
    saveRequest({
        id: Date.now().toString(),
        timestamp: Date.now(),
        name: formData.name,
        phone: formData.phone,
        metro: formData.metro,
        source: formData.source || 'default'
    });

    const msg = `📝 <b>ЗАЯВКА НА ОБРАТНЫЙ ЗВОНОК</b>\n\n` +
                `👤 <b>Имя:</b> ${formData.name}\n` +
                `📱 <b>Телефон:</b> ${formData.phone}\n` +
                `🚇 <b>Метро:</b> ${formData.metro || 'Не указано'}\n` +
                `➖➖➖➖➖➖➖➖\n` +
                `👤 <b>TG Аккаунт:</b> ${formData.telegramUser || 'Не определен'}\n` +
                `🤖 <b>Бот:</b> @${formData.source}`;

    try {
        await sendTelegramMessage(msg);
        setStep(AppStep.SUCCESS);
    } catch (e) {
        console.error(e);
        setErrorMsg('Ошибка отправки. Попробуйте позвонить нам.');
    } finally {
        setIsLoading(false);
    }
  };

  // --- API SENDER ---
  const sendTelegramMessage = async (text: string) => {
    const res = await fetch('/api/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            targetId: currentTargetId,
            botId: formData.source, 
            message: text
        })
    });
    const data = await res.json();
    if (!data.success && data.error) {
        // Если ошибка API, показываем её для админа (для отладки)
        if (data.details && data.details.description) {
            throw new Error(data.details.description);
        }
        throw new Error(data.error);
    }
  };

  // --- ADMIN COMMANDS ---
  const processAdminCommand = (input: string) => {
    const parts = input.trim().split(' ');
    const command = parts[0];
    const password = parts[1];
    const arg = parts[2];

    if (password !== ADMIN_PASSWORD) {
       setErrorMsg("⛔ Неверный пароль администратора");
       return;
    }

    if (command === '/report') {
        handleReport(); 
        return;
    }
    if (command === '/setid') {
        if (arg) {
            setTargetId(arg);
            setCurrentTargetId(arg);
            alert(`ID изменен на ${arg}`);
            setFormData(p => ({...p, name: ''}));
        }
        return;
    }
    if (command === '/stats') {
        const reqs = getRequests();
        alert(`Всего заявок на устройстве: ${reqs.length}`);
        setFormData(p => ({...p, name: ''}));
        return;
    }
  };

  const handleReport = async () => {
    setIsLoading(true);
    const requests = getRequests();
    const total = requests.length;
    
    // Simple report logic
    const reportMsg = `📊 <b>Ручной отчет (с устройства админа)</b>\n` +
                      `Всего сохраненных локально заявок: ${total}`;

    try {
        await sendTelegramMessage(reportMsg);
        alert('Отчет отправлен в канал');
    } catch (e) {
        alert('Ошибка отправки отчета');
    } finally {
        setIsLoading(false);
        setFormData(p => ({...p, name: ''}));
    }
  };

  // --- INPUT HANDLERS ---
  const formatPhoneNumber = (value: string) => {
    // Allows admin commands to pass through without formatting
    if (value.startsWith('/')) return value;

    const phoneNumber = value.replace(/\D/g, '');
    if (phoneNumber.length === 0) return '';
    
    let formatted = '';
    // Force +7
    if (['7', '8', '9'].includes(phoneNumber[0])) {
        if (phoneNumber[0] === '9') formatted = '+7 (9';
        else formatted = '+7 (';
        
        if (phoneNumber.length > 1) formatted += phoneNumber.substring(1, 4);
        if (phoneNumber.length >= 5) formatted += ') ' + phoneNumber.substring(4, 7);
        if (phoneNumber.length >= 8) formatted += '-' + phoneNumber.substring(7, 9);
        if (phoneNumber.length >= 10) formatted += '-' + phoneNumber.substring(9, 11);
    } else {
        return '+7';
    }
    return formatted;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      if (val.length < formData.phone.length) {
          // Deletion
          setFormData(p => ({ ...p, phone: val }));
          return;
      }
      setFormData(p => ({ ...p, phone: formatPhoneNumber(val) }));
  };


  // --- RENDERERS ---

  // 1. HEADER
  const renderHeader = () => (
    <header className="bg-white shadow-sm pt-4 pb-3 px-4 sticky top-0 z-50">
        <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
                <div className="bg-blue-600 w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-md">
                    <ShieldAlert size={24} />
                </div>
                <div>
                    <h1 className="font-bold text-gray-900 leading-tight">Служба Вскрытия</h1>
                    <p className="text-xs text-green-600 font-semibold flex items-center gap-1">
                        <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                        Мастер готов к выезду
                    </p>
                </div>
            </div>
            <button 
                onClick={handleCallOperator}
                className="bg-green-500 hover:bg-green-600 text-white p-2.5 rounded-full shadow-lg transition-transform active:scale-95"
            >
                <PhoneCall size={22} fill="currentColor" />
            </button>
        </div>
    </header>
  );

  // 2. MAIN MENU
  const renderMenu = () => (
    <div className="flex flex-col gap-4 px-4 py-6 flex-1 justify-center">
        <div className="text-center mb-6">
            <h2 className="text-xl font-bold text-gray-800 mb-3 leading-snug">
                Сломался замок? Не открывается дверь? Нужно вскрыть автомобиль?
            </h2>
            <p className="text-gray-600 font-medium bg-white/50 inline-block px-3 py-1 rounded-lg">
                Вы на верном пути
            </p>
        </div>

        <button 
            onClick={handleCallOperator}
            className="group relative bg-white border-2 border-green-500 hover:bg-green-50 active:bg-green-100 p-6 rounded-2xl shadow-sm transition-all flex flex-col items-center gap-3"
        >
            <div className="bg-green-100 text-green-600 p-4 rounded-full mb-1 group-hover:scale-110 transition-transform">
                <Phone size={32} />
            </div>
            <div className="text-center">
                <span className="block text-xl font-bold text-gray-800">Позвонить оператору</span>
            </div>
        </button>

        <button 
            onClick={() => setStep(AppStep.FORM)}
            className="group relative bg-white border border-gray-200 hover:border-blue-400 p-6 rounded-2xl shadow-sm transition-all flex flex-col items-center gap-3"
        >
            <div className="bg-blue-50 text-blue-600 p-4 rounded-full mb-1 group-hover:scale-110 transition-transform">
                <FileText size={32} />
            </div>
            <div className="text-center">
                <span className="block text-xl font-bold text-gray-800">Заказать обратный звонок</span>
                <span className="block text-sm text-gray-500 mt-1">Перезвоним в течение 5 минут</span>
            </div>
        </button>
        
        <div className="mt-8 bg-yellow-50 border border-yellow-100 p-4 rounded-xl text-xs text-yellow-800 text-center">
            Мы работаем круглосуточно по Москве и области. <br/>Вскрытие замков, дверей, сейфов, авто.
        </div>
    </div>
  );

  // 3. FORM
  const renderForm = () => (
    <div className="flex flex-col flex-1 px-4 py-6">
        <button 
            onClick={() => { setStep(AppStep.MENU); setErrorMsg(''); }}
            className="flex items-center text-gray-500 mb-6 hover:text-gray-800 transition-colors"
        >
            <ArrowLeft size={20} className="mr-1" /> Назад
        </button>

        <h2 className="text-2xl font-bold text-gray-800 mb-6">Заявка на выезд</h2>

        <div className="space-y-4 flex-1">
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ваше имя <span className="text-red-500">*</span></label>
                <div className="relative">
                    <User className="absolute left-3 top-3.5 text-gray-400" size={20} />
                    <input 
                        type="text"
                        placeholder="Как к вам обращаться"
                        value={formData.name}
                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                        className="w-full pl-10 pr-4 py-3 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow"
                    />
                </div>
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Телефон <span className="text-red-500">*</span></label>
                <div className="relative">
                    <Phone className="absolute left-3 top-3.5 text-gray-400" size={20} />
                    <input 
                        type="tel"
                        placeholder="+7 (999) 000-00-00"
                        value={formData.phone}
                        onChange={handlePhoneChange}
                        className="w-full pl-10 pr-4 py-3 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow"
                    />
                </div>
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Станция метро / Район</label>
                <div className="relative">
                    <MapPin className="absolute left-3 top-3.5 text-gray-400" size={20} />
                    <input 
                        type="text"
                        placeholder="Например: Таганская"
                        value={formData.metro}
                        onChange={(e) => setFormData({...formData, metro: e.target.value})}
                        className="w-full pl-10 pr-4 py-3 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow"
                    />
                </div>
            </div>
            
            {errorMsg && (
                <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100 animate-pulse">
                    {errorMsg}
                </div>
            )}
        </div>

        <button 
            onClick={handleSubmitForm}
            disabled={isLoading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-bold py-4 rounded-xl shadow-lg flex items-center justify-center gap-2 mt-6 transition-all active:scale-[0.98]"
        >
            {isLoading ? 'Отправка...' : <>Отправить заявку <Send size={20} /></>}
        </button>
    </div>
  );

  // 4. SUCCESS
  const renderSuccess = () => (
    <div className="flex flex-col flex-1 items-center justify-center px-6 text-center">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center text-green-600 mb-6 animate-bounce">
            <CheckCircle size={48} />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Заявка принята!</h2>
        <p className="text-gray-600 mb-8">
            Диспетчер получил ваши данные и перезвонит вам в ближайшую минуту.
        </p>
        
        <button 
            onClick={() => {
                setFormData(p => ({ ...p, name: '', phone: '', metro: '' }));
                setStep(AppStep.MENU);
            }}
            className="w-full bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold py-3 rounded-xl transition-colors"
        >
            Вернуться на главную
        </button>
    </div>
  );

  return (
    <div className="flex justify-center min-h-screen bg-gray-100">
      <div className="w-full max-w-md bg-white min-h-[100dvh] flex flex-col shadow-xl relative">
        {renderHeader()}
        
        {step === AppStep.MENU && renderMenu()}
        {step === AppStep.FORM && renderForm()}
        {step === AppStep.SUCCESS && renderSuccess()}
      </div>
    </div>
  );
};

export default App;
