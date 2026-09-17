import React, { useEffect, useRef, useState } from 'react';
import {
  Bot,
  Loader2,
  Send,
  Sparkles,
  User,
  X,
} from 'lucide-react';

import { api } from '../services/api';
import type { AiQueryResponse, AiSuggestedAction } from '../types';

interface Message {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  actions?: AiSuggestedAction[];
  timestamp: Date;
}

interface AiAssistantDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  isAdmin: boolean;
  apartmentUnit?: string | null;
  onActionTrigger?: (action: AiSuggestedAction) => void;
}

export const AiAssistantDrawer: React.FC<AiAssistantDrawerProps> = ({
  isOpen,
  onClose,
  isAdmin,
  apartmentUnit,
  onActionTrigger,
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize greeting on open if empty
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      if (isAdmin) {
        setMessages([
          {
            id: 'init-admin',
            sender: 'assistant',
            text: 'Chào Ban Quản Lý! Tôi là Trợ Lý AI Vận Hành Tòa Nhà Skyline Tower. Tôi đã đồng bộ toàn bộ telemetry, sự kiện Kafka và chỉ số từ mô hình Isolation Forest. Bạn cần tôi phân tích dữ liệu nào hôm nay?',
            actions: [
              { label: 'Kiểm tra cảnh báo khẩn cấp', action_type: 'navigate', target: 'alert_center' },
              { label: 'Cư dân chờ duyệt phòng', action_type: 'navigate', target: 'user_management' },
              { label: 'Tình trạng thiết bị IoT', action_type: 'query', target: 'thiết bị iot' },
            ],
            timestamp: new Date(),
          },
        ]);
      } else {
        setMessages([
          {
            id: 'init-resident',
            sender: 'assistant',
            text: `Xin chào Cư Dân Căn ${apartmentUnit || ''}! Tôi là Trợ Lý Cư Dân. Tôi có thể giúp bạn theo dõi hóa đơn tiền điện/nước tạm tính theo biểu giá EVN, kiểm tra thiết bị đang bật, hoặc gửi yêu cầu báo hỏng nhanh.`,
            actions: [
              { label: 'Tiền điện tháng này bao nhiêu?', action_type: 'query', target: 'tiền điện tháng này' },
              { label: 'Tiền nước tháng này', action_type: 'query', target: 'tiền nước' },
              { label: 'Báo sự cố kỹ thuật', action_type: 'modal', target: 'maintenance_modal' },
            ],
            timestamp: new Date(),
          },
        ]);
      }
    }
  }, [isOpen, isAdmin, apartmentUnit, messages.length]);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  if (!isOpen) return null;

  const handleSend = async (queryText?: string) => {
    const textToSend = (queryText || input).trim();
    if (!textToSend || isLoading) return;

    const userMsg: Message = {
      id: String(Date.now()),
      sender: 'user',
      text: textToSend,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!queryText) setInput('');
    setIsLoading(true);

    try {
      const res: AiQueryResponse = await api.chatWithAi(textToSend);
      const aiMsg: Message = {
        id: String(Date.now() + 1),
        sender: 'assistant',
        text: res.reply,
        actions: res.suggested_actions,
        timestamp: new Date(res.timestamp || Date.now()),
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (err: any) {
      const errorMsg: Message = {
        id: String(Date.now() + 1),
        sender: 'assistant',
        text: 'Xin lỗi, tôi gặp sự cố kết nối tới máy chủ phân tích. Vui lòng thử lại sau giây lát!',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleActionClick = (action: AiSuggestedAction) => {
    if (action.action_type === 'query' && action.target) {
      handleSend(action.target);
    } else if (onActionTrigger) {
      onActionTrigger(action);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        width: '420px',
        maxWidth: '100vw',
        zIndex: 10000,
        background: '#0d1322',
        borderLeft: '1px solid rgba(56, 189, 248, 0.25)',
        boxShadow: '-10px 0 30px rgba(0, 0, 0, 0.8)',
        display: 'flex',
        flexDirection: 'column',
        animation: 'slideLeft 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '16px 20px',
          background: 'linear-gradient(90deg, #111a2e, #13223f)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.2), rgba(56, 189, 248, 0.4))',
              border: '1px solid rgba(56, 189, 248, 0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#38bdf8',
            }}
          >
            <Sparkles size={18} />
          </div>
          <div>
            <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '6px' }}>
              Trợ Lý AI Tòa Nhà
              <span className="dot dot-cyan" />
            </div>
            <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
              {isAdmin ? 'Vận Hành & Giám Sát Kỹ Thuật' : `Trợ Lý Cư Dân Căn ${apartmentUnit || ''}`}
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          style={{
            background: 'rgba(255, 255, 255, 0.06)',
            border: 'none',
            borderRadius: '6px',
            padding: '6px',
            color: '#94a3b8',
            cursor: 'pointer',
          }}
        >
          <X size={18} />
        </button>
      </div>

      {/* Message List */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
        }}
      >
        {messages.map((m) => {
          const isUser = m.sender === 'user';
          return (
            <div
              key={m.id}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: isUser ? 'flex-end' : 'flex-start',
                gap: '6px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px',
                  flexDirection: isUser ? 'row-reverse' : 'row',
                  maxWidth: '90%',
                }}
              >
                <div
                  style={{
                    width: '26px',
                    height: '26px',
                    borderRadius: '50%',
                    background: isUser ? 'rgba(56, 189, 248, 0.2)' : 'rgba(34, 197, 94, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: isUser ? '#38bdf8' : '#4ade80',
                    flexShrink: 0,
                  }}
                >
                  {isUser ? <User size={14} /> : <Bot size={14} />}
                </div>

                <div
                  style={{
                    padding: '10px 14px',
                    borderRadius: '12px',
                    background: isUser
                      ? 'linear-gradient(135deg, #0284c7, #0369a1)'
                      : 'rgba(30, 41, 59, 0.8)',
                    border: isUser ? 'none' : '1px solid rgba(255, 255, 255, 0.08)',
                    color: '#f8fafc',
                    fontSize: '0.84rem',
                    lineHeight: '1.45',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  }}
                >
                  {m.text}
                </div>
              </div>

              {/* Action Chips */}
              {m.actions && m.actions.length > 0 && (
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '6px',
                    marginTop: '4px',
                    paddingLeft: '34px',
                  }}
                >
                  {m.actions.map((act, i) => (
                    <button
                      key={i}
                      onClick={() => handleActionClick(act)}
                      style={{
                        padding: '4px 10px',
                        background: 'rgba(56, 189, 248, 0.12)',
                        border: '1px solid rgba(56, 189, 248, 0.3)',
                        borderRadius: '20px',
                        color: '#38bdf8',
                        fontSize: '0.74rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        transition: 'all 0.15s ease',
                      }}
                      className="btn-action-chip"
                    >
                      <Sparkles size={11} />
                      {act.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {isLoading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#38bdf8', fontSize: '0.8rem', paddingLeft: '34px' }}>
            <Loader2 className="spin" size={16} />
            <span>AI đang phân tích dữ liệu thực tế...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Box */}
      <div
        style={{
          padding: '14px',
          background: 'rgba(15, 23, 42, 0.95)',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
        }}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          style={{ display: 'flex', gap: '8px' }}
        >
          <input
            type="text"
            placeholder="Hỏi về điện, nước, sự cố, thiết bị..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            style={{
              flex: 1,
              padding: '10px 14px',
              background: '#090e1a',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '8px',
              color: '#f8fafc',
              fontSize: '0.85rem',
              outline: 'none',
            }}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            style={{
              padding: '10px 14px',
              background: '#0284c7',
              border: 'none',
              borderRadius: '8px',
              color: '#ffffff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Send size={16} />
          </button>
        </form>
      </div>
    </div>
  );
};
