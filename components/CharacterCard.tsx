
import React from 'react';
import { Character } from '../types';

interface CharacterCardProps {
  character: Character;
  isActive: boolean;
  isTyping: boolean;
}

const CharacterCard: React.FC<CharacterCardProps> = ({ character, isActive, isTyping }) => {
  return (
    <div className={`relative flex flex-col items-center p-3 rounded-xl transition-all duration-300 ${isActive ? 'bg-white shadow-lg scale-105 border-2 border-indigo-500' : 'opacity-70 bg-slate-100'}`}>
      <div className="relative">
        <img 
          src={character.avatar} 
          alt={character.name} 
          className={`w-14 h-14 rounded-full border-2 ${isActive ? 'border-indigo-500' : 'border-transparent'}`}
        />
        {isTyping && (
          <div className="absolute -bottom-1 -right-1 bg-white px-2 py-0.5 rounded-full shadow-sm border text-[10px] font-medium text-indigo-600 flex items-center">
             <div className="typing-indicator mr-1 flex space-x-0.5"><span></span><span></span><span></span></div>
             思考中
          </div>
        )}
      </div>
      <span className="mt-2 text-xs font-semibold text-slate-700">{character.name.split(' (')[0]}</span>
      <span className={`mt-1 text-[9px] px-1.5 py-0.5 rounded text-white ${character.color}`}>
        {character.role === 'AGGRESSIVE' ? '强势' : 
         character.role === 'STRUCTURED' ? '框架' : 
         character.role === 'DETAIL' ? '细节' : '干扰'}
      </span>
    </div>
  );
};

export default CharacterCard;
