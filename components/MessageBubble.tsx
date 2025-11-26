import React from 'react';
import { Message, Sender } from '../types';
import { BOT_AVATAR, USER_AVATAR } from '../constants';

interface MessageBubbleProps {
  message: Message;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
  const isBot = message.sender === Sender.BOT;

  return (
    <div className={`flex w-full mb-4 ${isBot ? 'justify-start' : 'justify-end'}`}>
      <div className={`flex max-w-[80%] ${isBot ? 'flex-row' : 'flex-row-reverse'} items-end gap-2`}>
        
        {/* Avatar */}
        <div className="flex-shrink-0">
          <img 
            src={isBot ? BOT_AVATAR : USER_AVATAR} 
            alt={isBot ? "Bot" : "User"} 
            className="w-8 h-8 rounded-full object-cover border border-gray-300"
          />
        </div>

        {/* Bubble */}
        <div 
          className={`relative px-4 py-2 rounded-2xl shadow-sm text-sm md:text-base
            ${isBot 
              ? 'bg-white text-gray-800 rounded-bl-none' 
              : 'bg-blue-500 text-white rounded-br-none'
            }`}
        >
          <p className="whitespace-pre-wrap">{message.text}</p>
          <span className={`text-[10px] block mt-1 text-right opacity-70`}>
            {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>
    </div>
  );
};